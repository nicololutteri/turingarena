import { gql } from 'apollo-server-core';
import { ResolversWithModels } from '../../main/resolver-types';
import { Award } from '../award';

export const awardMaterialSchema = gql`
    extend type Award {
        "Name used to identify this award in this problem. Only for admins."
        name: String!
        "Name of this award to display to users."
        title: Text!
        "Possible grades that can be achieved for this award"
        gradeDomain: GradeDomain!
    }
`;

export const awardMaterialResolvers: ResolversWithModels<{
    Award: Award;
}> = {
    Award: {
        name: ({ index }) => `subtask.${index}`,
        title: ({ index }) => [{ value: `Subtask ${index}` }],
        gradeDomain: async ({ problem, index }, {}, ctx) => {
            const {
                scoring: { subtasks },
            } = await problem.getTaskInfo();
            const { max_score: max } = subtasks[index];

            return max > 0
                ? {
                      __typename: 'NumericGradeDomain',
                      max,
                      allowPartial: true, // FIXME
                      decimalPrecision: 0, // FIXME
                  }
                : {
                      __typename: 'BooleanGradeDomain',
                      _: true,
                  };
        },
    },
};
