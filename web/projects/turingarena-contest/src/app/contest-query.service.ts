import { Injectable } from '@angular/core';
import gql from 'graphql-tag';
import { Query } from 'apollo-angular';
import { ContestQuery, ContestQueryVariables } from './__generated__/ContestQuery';
import { problemMaterialFragment } from './graphql-fragments';

@Injectable({
  providedIn: 'root'
})
export class ContestQueryService extends Query<ContestQuery, ContestQueryVariables> {
  document = gql`
    query ContestQuery($userId: String) {
      serverTime
      user(id: $userId) {
        id
        displayName
        contestTitle
        startTime
        endTime
        problems {
          name
          submissions {
            createdAt
          }
          scores {
            scorableId
            score
          }
          ...ProblemMaterialFragment
        }
      }
    }
    ${problemMaterialFragment}
  `;
}
