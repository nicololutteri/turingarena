import { gql } from 'apollo-server-core';
import { Resolvers } from '../main/resolver-types';
import { Contest, ContestApi } from './contest';
import { SubmissionApi } from './submission';
import { MainView } from './view/main-view';

export const querySchema = gql`
    type Query {
        """
        Data visible in a front page, i.e., to contestants.
        """
        mainView("Name of the user viewing the front page, if logged in" username: ID): MainView!

        contests: [Contest!]!
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
        mainView: async ({}, { username }, ctx): Promise<MainView> => {
            const contest = await ctx.api(ContestApi).getDefault();

            if (contest === null) throw new Error(`missing 'default' contest (not supported right now)`);

            return new MainView(
                contest,
                username !== null && username !== undefined
                    ? await ctx.api(ContestApi).getUserByUsername(contest, username)
                    : null,
            );
        },
        contests: async ({}, {}, ctx) => ctx.table(Contest).findAll(),
        archive: (_, { uuid }) => ({ uuid }),
        submission: async ({}, { id }, ctx) => ctx.api(SubmissionApi).byId.load(id),
        fileContent: async ({}, {}, ctx) => ctx.fail(`not implemented`),
    },
};
