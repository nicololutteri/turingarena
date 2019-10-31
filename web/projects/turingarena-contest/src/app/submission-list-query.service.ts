import { Injectable } from '@angular/core';
import { Query } from 'apollo-angular';
import gql from 'graphql-tag';

import { SubmissionListQuery, SubmissionListQueryVariables } from './__generated__/SubmissionListQuery';
import { problemMaterialFragment } from './problem-material';

@Injectable({
  providedIn: 'root',
})
export class SubmissionListQueryService extends Query<SubmissionListQuery, SubmissionListQueryVariables> {
  document = gql`
    query SubmissionListQuery($userId: UserId!, $problemName: ProblemName!) {
      contestView(userId: $userId) {
        user {
          id
        }
        problem(name: $problemName) {
          name
          scores {
            awardName
            score
            submissionId
          }
          badges {
            awardName
            badge
            submissionId
          }
          submissions {
            id
            createdAt
            files {
              fieldId
              typeId
              name
              contentBase64
            }
            status
            scores {
              awardName
              score
            }
            badges {
              awardName
              badge
            }
          }
          ...ProblemMaterialFragment
        }
      }
    }
    ${problemMaterialFragment}
  `;
}
