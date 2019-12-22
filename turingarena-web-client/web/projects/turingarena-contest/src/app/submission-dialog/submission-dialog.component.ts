import { Component, Input, OnInit } from '@angular/core';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Apollo, QueryRef } from 'apollo-angular';
import gql from 'graphql-tag';
import { Duration } from 'luxon';

import { MaterialFragment } from '../__generated__/MaterialFragment';
import { ScoreRangeFragment } from '../__generated__/ScoreRangeFragment';
import { ScoreValueFragment } from '../__generated__/ScoreValueFragment';
import { SubmissionEvaluationFragment } from '../__generated__/SubmissionEvaluationFragment';
import { TimeUsageCellContentFragment } from '../__generated__/TimeUsageCellContentFragment';
import { TimeUsageFragment } from '../__generated__/TimeUsageFragment';
import { ValenceValueFragment } from '../__generated__/ValenceValueFragment';
import { ValueFragment } from '../__generated__/ValueFragment';
import { evaluationFragment } from '../evaluation';
import { submissionFragment } from '../submission';

import {
  SubmissionQuery,
  SubmissionQueryVariables,
} from './__generated__/SubmissionQuery';

@Component({
  selector: 'app-submission-dialog',
  templateUrl: './submission-dialog.component.html',
  styleUrls: ['./submission-dialog.component.scss'],
})
export class SubmissionDialogComponent implements OnInit {
  constructor(
    private readonly apollo: Apollo,
  ) { }

  faSpinner = faSpinner;

  @Input()
  submissionId!: string;

  @Input()
  problem!: MaterialFragment;

  @Input()
  modal!: NgbActiveModal;

  submissionQueryRef!: QueryRef<SubmissionQuery, SubmissionQueryVariables>;

  ngOnInit() {
    const { submissionId } = this;
    this.submissionQueryRef = this.apollo.watchQuery({
      query: gql`
        query SubmissionQuery($submissionId: String!) {
          submission(submissionId: $submissionId) {
            ...SubmissionFragment
            ...SubmissionEvaluationFragment
          }
        }
        ${submissionFragment}
        ${evaluationFragment}
      `,
      variables: { submissionId },
      pollInterval: 1000,
    });
  }

  getEvaluationRecord(submission: SubmissionEvaluationFragment) {
    const record: Record<string, ValueFragment> = {};
    for (const event of submission.evaluationEvents) {
      if (event.__typename === 'ValueEvent') {
        const { key, value } = event;
        record[key] = value;
      }
    }

    return record;
  }

  displayTimeUsage({ seconds }: TimeUsageFragment, content: TimeUsageCellContentFragment) {
    const maxRelevant = content.timeUsageMaxRelevant;
    const extraPrecision = 3;
    const fractionDigits = Math.max(Math.round(-Math.log10(maxRelevant.seconds) + extraPrecision), 0);

    const millisPrecision = 3;

    const duration = Duration.fromObject({ seconds });
    if (fractionDigits > millisPrecision) {
      return `${duration.as('milliseconds').toFixed(fractionDigits - millisPrecision)} ms`;
    } else {
      return `${duration.as('seconds').toFixed(fractionDigits)} s`;
    }
  }

  getValence(value?: ValenceValueFragment) {
    if (value === undefined) { return 'unknown'; }

    return value.valence.toLowerCase();
  }

  getScoreValence(value: ScoreValueFragment | undefined, range: ScoreRangeFragment) {
    if (value === undefined) { return 'unknown'; }

    const { score } = value;
    if (score <= 0) { return 'failure'; }
    if (score < range.max) { return 'partial'; }

    return 'success';
  }
}