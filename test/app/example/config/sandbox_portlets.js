"use strict";

module.exports = {
  plugins: {
    pluginWebweaver: {
      portlets: {
        default: {},
        manager: {
          defaultRedirectUrl: "/example/dashboard",
          cors: {
            enabled: true,
            mode: "simple"
          },
          errorHandler: {
            mappings: [
              {
                errorName: "Error",
                default: {
                  statusCode: 402,
                  statusMessage: "Invalid credentials"
                }
              },
              {
                errorName: "NoCodeError",
                default: {
                  statusCode: 405,
                  statusMessage: "NoCodeError default message"
                }
              }
            ]
          },
          session: {
            cookie: {
              secure: true,
              httpOnly: true,
              domain: "devebot.com",
              path: "relative/path",
              expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
            }
          }
        }
      }
    },
    pluginWebserver: {
      portlets: {
        default: {},
        manager: {
          host: "0.0.0.0",
          port: 17979
        }
      }
    }
  }
};
