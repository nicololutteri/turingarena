import { Injectable } from '@angular/core';
import { Query } from 'apollo-angular';
import gql from 'graphql-tag';

import { SubmissionQuery, SubmissionQueryVariables } from './__generated__/SubmissionQuery';
import { evaluationFragment } from './evaluation';
import { submissionFragment } from './submission';

@Injectable({
  providedIn: 'root',
})
export class SubmissionQueryService extends Query<SubmissionQuery, SubmissionQueryVariables> {
  document = gql`
    query SubmissionQuery($submissionId: String!) {
      submission(submissionId: $submissionId) {
        ...SubmissionFragment
        ...SubmissionEvaluationFragment
      }
    }
    ${submissionFragment}
  `;
}
