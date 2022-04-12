import { constants } from 'fs';
import { access, readdir } from 'fs/promises';
import { join, resolve, sep } from 'path';

export const __dirname = resolve();

export const __project_dirname = join(__dirname, '../');
export const __server_dirname = join(__project_dirname, 'UEFI');
export const __client_dirname = join(__project_dirname, 'OS');

export const __client_wwwroot_dirname = join(__client_dirname, 'wwwroot');
export const __client_wwwrootdev_dirname = join(__client_dirname, 'wwwroot-dev');

export const __special_characters_regex = /[ `!@#$%^&*()_+\=\[\]{};':"\\|,.<>\/?~]/;

export async function fileExists(path)
{
    return await access(path, constants.R_OK | constants.W_OK).then(data => true).catch(err => false);
}

export async function findFiles(path)
{
    const entries = await readdir(path, { withFileTypes: true }).then(data => data).catch(err => console.error(err));
    const files = entries.filter(file => !file.isDirectory()).map(file => ({ ...file, path: join(path, file.name) }));;
    const folders = entries.filter(folder => folder.isDirectory());
    for (const folder of folders) files.push(...await findFiles(`${path}${sep}${folder.name}${sep}`));
    return files;
}

export function filterFiles(files, ext)
{
    return Object.values(files).filter(file => String(file.name).split('.').pop() == ext);
}

export function isUpperCase(str)
{
    return str === str.toUpperCase();
}

export function isEmptyOrSpaces(str)
{
    return str === null || str.match(/^ *$/) !== null;
}