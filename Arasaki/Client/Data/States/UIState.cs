namespace Arasaki.Client.Data.States;

public class UIState
{
    public event Action PageContextHasChanged;
    public List<PageContext> PageContexts = new();
    private PageContext pageContext;
    public PageContext CurrentPageContext
    {
        get
        {
            return pageContext;
        }
        set
        {
            pageContext = value;
            PageContextHasChanged?.Invoke();
        }
    }
}
