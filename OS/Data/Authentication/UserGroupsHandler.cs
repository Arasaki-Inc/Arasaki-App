using Microsoft.AspNetCore.Authorization;

namespace Arasaki.OS.Data.Authentication
{
    public class UserGroupsHandler : AuthorizationHandler<UserGroupsRequirement>
    {
        protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, UserGroupsRequirement requirement)
        {
            try
            {
                context.User.Claims.ToList().ForEach(o => Logger.LogInfo(o.Type));
                string username = context.User.Claims.First(c => c.Type == "name").Value;
                string[] groups = requirement.Groups;

                if (groups.Contains("Admins")) context.Succeed(requirement);
                else context.Fail();
            }
            catch { context.Fail(); }
            return Task.CompletedTask;
        }
    }
}
