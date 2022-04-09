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
                    PublicName = "Update",
                    PrivateName = "update",
                    RelativeURLs = new() { "/uefi/update" },
                    BackgroundRelativeURL = "/img/server/backgrounds/update.svg"
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
                    PublicName = "App Permissions",
                    PrivateName = "permissions",
                    RelativeURLs = new() { "/uefi/perms" },
                    BackgroundRelativeURL = "/img/server/backgrounds/permissions.svg"
                },
                new PageContext
                {
                    PublicName = "App Maintenance",
                    PrivateName = "maintenance",
                    RelativeURLs = new() { "/uefi/maintenance" },
                    BackgroundRelativeURL = "/img/server/backgrounds/maintenance.svg"
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
