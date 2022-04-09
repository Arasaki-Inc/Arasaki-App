/// <reference path="../node_modules/@types/requirejs/index.d.ts" />
/// <reference path="../node_modules/@types/chart.js/index.d.ts" />
/// <reference path="../node_modules/gsap/types/index.d.ts" />

(() =>
{
    window.ui = 
    {
        common: 
        {
            isMobileScreen: () => window.innerWidth <= 767.98,
            isTabletScreen: () => window.innerWidth <= 1199.98,
        },
        uefi:
        {

        },
        os:
        {

        }
    }
})()