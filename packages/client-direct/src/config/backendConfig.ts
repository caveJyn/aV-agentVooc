import { TypeInput as InputType } from "supertokens-node/lib/build/types";
import Session from "supertokens-node/recipe/session";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import ThirdParty from "supertokens-node/recipe/thirdparty";
import Dashboard from "supertokens-node/recipe/dashboard";
import { sanityClient } from "@elizaos-plugins/plugin-sanity";
import { elizaLogger } from "@elizaos/core";

export function backendConfig(): InputType {
    return {
        framework: "express",
        supertokens: {
            connectionURI: process.env.SUPERTOKENS_CONNECTION_URI || "https://try.supertokens.com",
            apiKey: process.env.SUPERTOKENS_API_KEY || "",
        },
        appInfo: {
            appName: "elizaOS",
            apiDomain: process.env.API_DOMAIN || "http://localhost:3000",
            websiteDomain: process.env.WEBSITE_DOMAIN || "http://localhost:5173",
            apiBasePath: "/api/auth",
            websiteBasePath: "/auth",
        },
        recipeList: [
            EmailPassword.init({
                signUpFeature: {
                    formFields: [
                        { id: "name", optional: true },
                    ],
                },
                override: {
                    apis: (originalImplementation) => ({
                      ...originalImplementation,
                      signUpPOST: async (input) => {
                        if (originalImplementation.signUpPOST === undefined) {
                          throw new Error("Should never come here");
                        }
                        const response = await originalImplementation.signUpPOST(input);
                        if (response.status === "OK") {
                          const userId = response.user.id;
                          const email = response.user.emails?.[0];
                          const formFields = input.formFields;
                          const name = formFields.find((f) => f.id === "name")?.value || "Unknown User";
                  
                          elizaLogger.info(`User signed up: userId=${userId}, email=${email}, name=${name}`);
                  
                          try {
                            const existingUser = await sanityClient.fetch(
                              `*[_type == "User" && userId == $userId][0]`,
                              { userId }
                            );
                            if (!existingUser) {
                              if (!email) {
                                elizaLogger.error(`No email provided for userId=${userId}, cannot create User`);
                              } else {
                                const User = await sanityClient.create({
                                  _type: "User",
                                  name,
                                  email,
                                  interest: "elizaOS",
                                  referralSource: "email-signup",
                                  userId,
                                  createdAt: new Date().toISOString(),
                                  userType: "email",
                                });
                                elizaLogger.info(`Created User: userId=${userId}, email=${User._id}`);
                              }
                            } else {
                              elizaLogger.info(`User already exists for userId=${userId}, email=${existingUser.email}`);
                            }
                          } catch (error) {
                            elizaLogger.error(`Failed to create User for userId=${userId}:`, error);
                          }
                        } else {
                          elizaLogger.warn(`Signup failed for email=${input.formFields.find(f => f.id === "email")?.value}: status=${response.status}`);
                        }
                        return response;
                      },
                    }),
                  },
            }),
            ThirdParty.init({
                signInAndUpFeature: {
                    providers: [
                        {
                            config: {
                                thirdPartyId: "google",
                                clients: [
                                    {
                                        clientId: process.env.GOOGLE_CLIENT_ID || "",
                                        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
                                        scope: [
                                            "https://www.googleapis.com/auth/userinfo.email",
                                            "https://www.googleapis.com/auth/userinfo.profile",
                                        ],
                                    },
                                ],
                            },
                        },
                    ],
                },
                override: {
                    functions: (originalImplementation) => {
                      return {
                        ...originalImplementation,
                        signInUp: async function (input) {
                          const response = await originalImplementation.signInUp(input);
                          if (response.status === "OK") {
                            const userId = response.user.id;
                            const email = response.user.emails?.[0] || `no-email-${userId}@example.com`;
                            const name =
                              input.thirdPartyId === "google"
                                ? response.rawUserInfoFromProvider?.fromUserInfoAPI?.name || "Google User"
                                : "Unknown User";
                  
                            elizaLogger.info(`Third-party signInUp: userId=${userId}, email=${email}, name=${name}`);
                  
                            try {
                              const existingUser = await sanityClient.fetch(
                                `*[_type == "User" && userId == $userId][0]`,
                                { userId }
                              );
                              if (!existingUser) {
                                const User = await sanityClient.create({
                                  _type: "User",
                                  name,
                                  email,
                                  interest: "elizaOS",
                                  referralSource: input.thirdPartyId,
                                  userId,
                                  createdAt: new Date().toISOString(),
                                  userType: "email",
                                });
                                elizaLogger.info(`Created User: userId=${userId}, email=${email}, _id=${User._id}`);
                              } else {
                                elizaLogger.info(`User already exists for userId=${userId}, email=${existingUser.email}`);
                              }
                            } catch (error) {
                              elizaLogger.error(`Failed to create User for userId=${userId}:`, error);
                            }
                          } else {
                            elizaLogger.warn(`Third-party signInUp failed: status=${response.status}`);
                          }
                          return response;
                        },
                      };
                    },
                  },
            }),
            Session.init({
                cookieSecure: process.env.NODE_ENV === "production", // false for local development
                cookieSameSite: "lax", // Allows cookies on redirects
                sessionExpiredStatusCode: 401,
            }),
            Dashboard.init({
                admins: ["k.ullah.93@gmail.com"],
                override: {
                    apis: (originalImplementation) => {
                        elizaLogger.info("Dashboard recipe initialized");
                        return originalImplementation;
                    },
                },
            }),
        ],
    };
}