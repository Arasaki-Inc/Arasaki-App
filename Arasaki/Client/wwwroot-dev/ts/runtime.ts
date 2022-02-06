(() =>
{
    window.runtime = 
    {
        isMobileScreen: () => window.innerWidth <= 767.98,
        isTabletScreen: () => window.innerWidth <= 1199.98
    }
})()