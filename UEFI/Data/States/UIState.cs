namespace Arasaki.UEFI.Data.States;

public class UIState
{
    public event Action PageContextHasChanged;
    public List<PageContext> PageContexts = new()
            {
                new PageContext
                {
                    PublicName = "Arasaki UEFI",
                    PrivateName = "uefi",
                    RelativeURLs = new() { "/uefi", "/" },
                    BackgroundRelativeURL = "/img/server/backgrounds/uefi.svg"
                },
                new PageContext
                {
                    PublicName = "App Settings",
                    PrivateName = "settings",
                    RelativeURLs = new() { "/uefi/settings" },
                    BackgroundRelativeURL = "/img/server/backgrounds/settings.svg"
                },
                new PageContext
                {
                    PublicName = "Permissions",
                    PrivateName = "permissions",
                    RelativeURLs = new() { "/uefi/perms" },
                    BackgroundRelativeURL = "/img/server/backgrounds/permissions.svg"
                },
                new PageContext
                {
                    PublicName = "Changelog",
                    PrivateName = "changelog",
                    RelativeURLs = new() { "/uefi/changelog" },
                    BackgroundRelativeURL = "/img/server/backgrounds/changelog.svg"
                },
                new PageContext
                {
                    PublicName = "About",
                    PrivateName = "about",
                    RelativeURLs = new() { "/uefi/about" },
                    BackgroundRelativeURL = "/img/server/backgrounds/about.svg"
                }
            };
    private PageContext pageContext;
    public PageContext CurrentPageContext
    {
        get => pageContext;
        set
        {
            pageContext = value;
            PageContextHasChanged?.Invoke();
        }
    }
}
