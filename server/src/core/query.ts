import { gql } from 'apollo-server-core';
import { Resolvers } from '../main/resolver-types';
import { Contest, ContestApi } from './contest';
import { MainView } from './main-view';
import { Problem, ProblemApi } from './problem';
import { SubmissionApi } from './submission';
import { User, UserApi } from './user';

export const querySchema = gql`
    type Query {
        """
        Data visible in a front page, i.e., to contestants.
        """
        mainView("Name of the user viewing the front page, if logged in" username: ID): MainView!

        users: [User!]!
        user(username: ID!): User!
        contests: [Contest!]!
        contest(name: ID!): Contest!
        problems: [Problem!]!
        problem(name: ID!): Problem!
        fileContent(id: ID!): FileContent!
        archive(uuid: ID!): Archive!
        submission(id: ID!): Submission!
    }
`;

export interface QueryModelRecord {
    Query: {};
}

export const queryResolvers: Resolvers = {
    Query: {
        mainView: async ({}, { username }, ctx): Promise<MainView> =>
            new MainView(
                username !== null && username !== undefined ? await ctx.api(UserApi).byUsername.load(username) : null,
            ),
        users: async ({}, {}, ctx) => ctx.table(User).findAll({ include: [ctx.table(Contest)] }),
        user: async (root, { username }, ctx) => ctx.api(UserApi).byUsername.load(username),
        contests: async ({}, {}, ctx) => ctx.table(Contest).findAll(),
        contest: async (root, { name }, ctx) => ctx.api(ContestApi).byName.load(name),
        problems: async ({}, {}, ctx) => ctx.table(Problem).findAll(),
        problem: async (root, { name }, ctx) => ctx.api(ProblemApi).byName.load(name),
        archive: (_, { uuid }) => ({ uuid }),
        submission: async (root, { id }, ctx) => ctx.api(SubmissionApi).byId.load(id),
        fileContent: async ({}, {}, ctx) => ctx.fail(`not implemented`),
    },
};
