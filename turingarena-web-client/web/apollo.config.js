const path = require("path");

/** @type { import('apollo').ApolloConfig } */
const config = {
  client: {
    includes: ["./projects/*/src/**/*.ts"],
    excludes: [],
    service: {
      name: "turingarena-contest",
      localSchemaFile: path.resolve(
        __dirname,
        "graphql-schema.json"
      )
    }
  }
};

module.exports = config;
