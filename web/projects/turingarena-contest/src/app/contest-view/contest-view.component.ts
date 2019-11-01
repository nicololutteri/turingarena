import { Component, OnInit } from '@angular/core';
import {
  faAward,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faFile,
  faFileAlt,
  faFileArchive,
  faFilePdf,
  faHistory,
  faHourglassHalf,
  faList,
  faPaperPlane,
  faSignInAlt,
  faSignOutAlt,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons';
import { NgbModal, NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Apollo, QueryRef } from 'apollo-angular';
import gql from 'graphql-tag';
import { DateTime, Duration } from 'luxon';
import { interval } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { ProblemMaterialFragment } from '../__generated__/ProblemMaterialFragment';
import { ProblemTacklingFragment } from '../__generated__/ProblemTacklingFragment';
import { Auth, AuthService } from '../auth.service';
import { problemFragment } from '../problem';
import { problemMaterialFragment, scoreRanges } from '../problem-material';
import { submissionFragment } from '../submission';

import {
  ContestQuery,
  ContestQueryVariables,
} from './__generated__/ContestQuery';
import { LoginMutation, LoginMutationVariables } from './__generated__/LoginMutation';

const pollInterval = 5000;

@Component({
  selector: 'app-contest-view',
  templateUrl: './contest-view.component.html',
  styleUrls: ['./contest-view.component.scss'],
})
export class ContestViewComponent implements OnInit {
  faPaperPlane = faPaperPlane;
  faCheck = faCheck;
  faSignInAlt = faSignInAlt;
  faSignOutAlt = faSignOutAlt;
  faList = faList;
  faFilePdf = faFilePdf;
  faHistory = faHistory;
  faSpinner = faSpinner;
  faChevronLeft = faChevronLeft;
  faChevronRight = faChevronRight;
  faHourglassHalf = faHourglassHalf;
  faAward = faAward;

  mimeTypeIcons = {
    'application/pdf': faFilePdf,
    'text/plain': faFileAlt,
    'application/gzip': faFileArchive,
    'application/zip': faFileArchive,
  };
  faFile = faFile;

  focusMode = false;

  newSubmissionId?: string;

  logInInvalidToken = false;

  constructor(
    private readonly authService: AuthService,
    private readonly apollo: Apollo,
    readonly modalService: NgbModal,
  ) { }

  get userId() {
    const auth = this.authService.getAuth();

    return auth !== undefined ? auth.userId : undefined;
  }

  contestQuery!: QueryRef<ContestQuery, ContestQueryVariables>;

  get selectedProblemName() {
    try {
      const selectedProblemNameJson = localStorage.getItem('selectedProblemName');

      if (selectedProblemNameJson === null) { return undefined; }

      return JSON.parse(selectedProblemNameJson) as string;
    } catch (e) {
      localStorage.removeItem('selectedProblemName');
    }
  }

  set selectedProblemName(name: string | undefined) {
    localStorage.setItem('selectedProblemName', JSON.stringify(name));
  }

  // tslint:disable-next-line: no-magic-numbers
  nowObservable = interval(1000).pipe(
    startWith([0]),
    map(() => DateTime.local()),
  );

  ngOnInit() {
    this.setQuery();
  }

  setQuery() {
    this.contestQuery = this.apollo.watchQuery<ContestQuery, ContestQueryVariables>({
      query: gql`
        query ContestQuery($userId: UserId) {
          serverTime
          contestView(userId: $userId) {
            user {
              id
              displayName
            }
            contestTitle
            startTime
            endTime
            problems {
              name
              tackling {
                ...ProblemTacklingFragment
                submissions { ...SubmissionFragment }
              }
              ...ProblemMaterialFragment
            }
          }
        }
        ${problemFragment}
        ${problemMaterialFragment}
        ${submissionFragment}
      `,
      variables: { userId: this.userId },
      pollInterval,
    });
  }

  getTaskLetter(index: number) {
    return String.fromCharCode('A'.charCodeAt(0) + index);
  }

  getContestState(data: ContestQuery | undefined) {
    if (data === undefined) { return undefined; }

    const { contestView: { startTime, endTime, problems } } = data;

    const getProblemState = (problem: ProblemMaterialFragment, tackling: ProblemTacklingFragment) => {
      const getAwardState = ({ name }: { name: string }) => {
        const scoreState = tackling.scores.find((s) => s.awardName === name);
        const badgeState = tackling.badges.find((s) => s.awardName === name);

        return {
          score: scoreState !== undefined ? scoreState.score as number : 0,
          badge: badgeState !== undefined ? badgeState.badge : false,
        };
      };

      return {
        getAwardState,
        score: scoreRanges(problem).map(getAwardState).map(({ score }) => score).reduce((a, b) => a + b, 0),
        maxScore: scoreRanges(problem).map((s) => s.range.max as number).reduce((a, b) => a + b, 0),
        precision: scoreRanges(problem).map((s) => s.range.precision).reduce((a, b) => Math.max(a, b), 0),
      };
    };

    const problemTacklings = problems !== null ? problems.map((problem) => {
      const { tackling } = problem;
      if (tackling !== null) {
        return getProblemState(problem, tackling);
      } else {
        return {
          score: 0,
          maxScore: 0,
          precision: 0,
        };
      }
    }) : [];

    return {
      hasScore: problemTacklings.length > 0,
      startTime: DateTime.fromISO(startTime),
      endTime: DateTime.fromISO(endTime),
      score: problemTacklings.map((s) => s.score).reduce((a, b) => a + b, 0),
      maxScore: problemTacklings.map((s) => s.maxScore).reduce((a, b) => a + b, 0),
      precision: problemTacklings.map((s) => s.precision).reduce((a, b) => Math.max(a, b), 0),
      getProblemState,
    };
  }

  formatDuration(duration: Duration) {
    return duration.toFormat('hh:mm:ss');
  }

  async setAuth(auth: Auth) {
    await this.authService.setAuth(auth);
    this.setQuery();
  }

  async logIn(event: Event, modal: NgbActiveModal) {
    const formData = new FormData(event.target as HTMLFormElement);
    const { data } = await this.apollo.mutate<LoginMutation, LoginMutationVariables>({
      mutation: gql`
        mutation LoginMutation($token: String!) {
          auth(token: $token) {
            token
            userId
          }
        }
      `,
      variables: {
        token: formData.get('token') as string,
      },
    }).toPromise();

    if (data === null || data === undefined) { throw Error('error during login'); }

    if (data.auth === null) {
      this.logInInvalidToken = true;
    } else {
      const { token, userId } = data.auth;

      await this.setAuth({ token, userId });
      modal.close();
    }
  }


}
