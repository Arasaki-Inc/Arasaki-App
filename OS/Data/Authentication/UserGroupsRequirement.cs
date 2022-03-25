using Microsoft.AspNetCore.Authorization;

namespace Arasaki.OS.Data.Authentication
{
    public class UserGroupsRequirement : IAuthorizationRequirement
    {
        public string[] Groups { get; }

        public UserGroupsRequirement(string[] groups)
        {
            Groups = groups;
        }
    }
}
