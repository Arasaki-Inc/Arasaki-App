import { readFile } from 'fs/promises';
import { extname, sep } from 'path';

import { findFiles, isEmptyOrSpaces, isUpperCase, __client_dirname, __server_dirname, __special_characters_regex } from './bundler_utils.js';

export async function analyse_css(outputCss) 
{
    var minified = '';
    var usedSelectors = [];
    const files = (await findFiles(__client_dirname)).concat(await findFiles(__server_dirname));
    await Promise.all(files.filter(x => extname(x.name) == '.razor' || extname(x.name) == '.html' || extname(x.name) == '.cshtml').map(async item => 
    {
        if (item.name == '_Imports.razor' || item.path.includes(`${sep}bin${sep}`) || 
            item.path.includes(`${sep}obj${sep}`) || item.path.includes(`${sep}node_modules${sep}`) || 
            item.path.includes(`${sep}wwwroot-dev${sep}`)) return;
        const fileLines = (await readFile(item.path, 'utf-8').then(data => data).catch(err => { throw err; })).split(/\r?\n/);
        if (fileLines)
        {
            fileLines.map(l =>
            {
                const line = l.trim();
                if (line.startsWith('@using') || line.startsWith('@inject') || line.startsWith('@code')) return;
                else if (line.startsWith('<') && line.endsWith('>') && !line.startsWith('</') && !line.startsWith('<!DOCTYPE') && !line.startsWith('<head') && !line.startsWith('<base')
                            && !line.startsWith('<meta') && !line.startsWith('<link') && !line.startsWith('<script') && !line.startsWith('<!--') && !isUpperCase(line.slice(1, 2))) 
                {
                    if (line.includes('id=')) 
                    {
                        const id = parseAttribute(line, 'id=');
                        if (!usedSelectors.includes(`#${id}`)) usedSelectors.push(`#${id}`);
                    }
                    if (line.includes('class=')) parseAttribute(line, 'class=').split(' ').forEach(selector =>
                    { 
                        if (!usedSelectors.includes(`.${selector}`) && !isEmptyOrSpaces(selector) && !__special_characters_regex.test(selector)) usedSelectors.push(`.${selector}`);
                    });
                    var pushable = '';
                    if (line.includes('<') && line.includes('</'))
                    {
                        const sliced = line.slice(1, line.indexOf('>'));
                        if (sliced.includes(' ')) pushable = sliced.slice(0, sliced.indexOf(' '));
                        else pushable = line.slice(1, line.indexOf('>'));
                    }
                    else pushable = line.slice(1, line.indexOf(' ')).trim();
                    if (!__special_characters_regex.test(pushable) && !usedSelectors.includes(pushable)) usedSelectors.push(pushable);
                }
            });
        }
    }));
    
    var minified = '';
    var minifiedLines = [];
    var onMultiSelectorConstruct = false;
    var splitCSS = outputCss.replace('\r', '').split('\n');
    for (let x = 0; x < splitCSS.length; x++) 
    {
        var line = splitCSS[x].trim();
        if (line.startsWith('@charset') || line.startsWith('@import') || line.startsWith('@namespace')) minifiedLines.push(line);
        if (line.endsWith(','))
        {
            for (let y = x; y < splitCSS.length - x; y++) 
            {
                line = splitCSS[y].trim();
                if (checkIfSelectorIncluded(usedSelectors, line)) minifiedLines.push(line);
                if (line.endsWith('{') && !line.endsWith(','))
                {
                    //if (minifiedLines[minifiedLines.length - 1].endsWith(',')) minifiedLines[minifiedLines.length - 1] = minifiedLines[minifiedLines.length - 1].replace(',', ' {');
                    onMultiSelectorConstruct = true;
                    x = y;
                    break;
                }
            }
        }
        if (line.endsWith('{'))
        {
            if (line.startsWith('@keyframes') || line.startsWith('@media') || line.startsWith('@page') || line.startsWith('@supports')) 
            {
                minifiedLines.push(line);
                for (let y = x + 1; y < splitCSS.length; y++)
                {
                    line = splitCSS[y].trim();
                    if (onMultiSelectorConstruct || (line.endsWith('{') && (line.startsWith('*') || line.startsWith(':') || line.startsWith('::') || checkIfSelectorIncluded(usedSelectors, line))))
                    {
                        onMultiSelectorConstruct = false;
                        for (let z = y; z < splitCSS.length; z++)
                        {
                            line = splitCSS[z].trim();
                            minifiedLines.push(line);
                            if (line.startsWith('}'))
                            {
                                y = z;
                                break;
                            }
                        }
                    }
                    else if (line.endsWith('{'))
                    {
                        for (let z = y + 1; z < splitCSS.length; z++)
                        {
                            line = splitCSS[z].trim();
                            if (line.startsWith('}'))
                            {
                                y = z;
                                break;
                            }
                        }
                    }
                    else if (line.startsWith('}'))
                    {
                        if (minifiedLines[minifiedLines.length - 1].endsWith('{')) minifiedLines.pop();
                        else minifiedLines.push(line);
                        x = y;
                        break;
                    }
                }
            }
            else if (onMultiSelectorConstruct || (line.startsWith('@font-face') || line.startsWith('*') || line.startsWith(':') || line.startsWith('::') || checkIfSelectorIncluded(usedSelectors, line)))
            {
                for (let y = x; y < splitCSS.length; y++)
                {
                    onMultiSelectorConstruct = false;
                    line = splitCSS[y].trim();
                    if (line != minifiedLines[minifiedLines.length - 1]) minifiedLines.push(line);
                    if (line.startsWith('}'))
                    {
                        x = y;
                        break;
                    }
                }
            }
            else if (line.endsWith('{'))
            {
                for (let y = x; y < splitCSS.length; y++)
                {
                    line = splitCSS[y].trim();
                    if (line.startsWith('}'))
                    {
                        x = y;
                        break;
                    }
                }
            }
        }
    }

    // TODO: This needs to be perfected over time.
    function checkIfSelectorIncluded(usedSelectors, line) {return usedSelectors.some(x =>/* line.startsWith('.') || line.startsWith('#') ? 
                                                                                          line.startsWith(`${x} `) || line.includes(` ${x} `)                                                              || line.endsWith(` ${x} {`)
                                                                                       || line.startsWith(`${x},`) || (line.includes(`${x} `) && !line.includes(`-${x} `))                                 || line.startsWith(`${x} {`)
                                                                                                                   || ((line.includes(` ${x}::`) || line.includes(`${x}::`)) && !line.includes(`-${x}::`))
                                                                                                                   || ((line.includes(` ${x}:`) || line.includes(`${x}:`)) && !line.includes(`-${x}:`))
                                                                                                                    
                                                                                                                    :*/ line.startsWith(x) && !line.startsWith(`${x}-`));}
    function parseAttribute(line, attribute) 
    {
        const parse = line.slice(line.indexOf(attribute) + attribute.length + 1);
        return parse.substring(0, parse.indexOf('"'));
    }

    minifiedLines.forEach(line => minified += `${line.replace(': ', ':')}`);
    return minified;
}