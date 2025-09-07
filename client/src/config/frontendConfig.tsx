import EmailPassword from "supertokens-web-js/recipe/emailpassword";
import ThirdParty from "supertokens-web-js/recipe/thirdparty";
import Session from "supertokens-web-js/recipe/session";
import { appInfo } from "./appInfo";

export const frontendConfig = () => {
    return {
        appInfo,
        recipeList: [
            EmailPassword.init(),
            ThirdParty.init(),
            Session.init(),
        ],
    };
};