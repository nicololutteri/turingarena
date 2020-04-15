import { gql } from '@apollo/client';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { css, cx } from 'emotion';
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ContestViewAsideFragment } from '../generated/graphql-types';
import { badgeCss, getBadgeCssByValence } from '../util/components/badge';
import { buttonNormalizeCss } from '../util/components/button';
import { FragmentProps } from '../util/fragment-props';
import { Theme } from '../util/theme';
import { ContestViewClock, contestViewClockFragment } from './contest-view-clock';
import { GradeField, scoreFieldFragment } from './fields/grade-field';
import { textFragment } from './text';

// TODO: duplicated?
const headerClass = css`
  text-transform: uppercase;
  font-size: 1.25rem;
  margin: 0 0 0.5rem;
  font-weight: 500;
  line-height: 1.2;
`;

export function ContestViewAside({ data }: FragmentProps<ContestViewAsideFragment>) {
  const [visible, setVisible] = useState(true);

  if (data.problemSetView === null) {
    return null;
  }

  return (
    <div
      className={css`
        display: flex;
        flex-direction: row;
      `}
    >
      <button
        onClick={() => setVisible(!visible)}
        className={cx(
          buttonNormalizeCss,
          css`
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            font-size: 16px;
            background-color: transparent;
            width: 16px;
            margin-right: -16px;
            z-index: 1;
            opacity: 0;

            &:hover {
              background-color: rgba(0, 0, 0, 0.1);
              opacity: 1;
            }
          `,
        )}
      >
        <FontAwesomeIcon icon={visible ? 'chevron-left' : 'chevron-right'} />
      </button>
      <aside
        className={
          visible
            ? css`
                flex: 0 0 auto;
                overflow-y: auto;

                width: 16em;
                padding: 16px;
                background-color: ${Theme.colors.light};
                border-right: 1px solid rgba(0, 0, 0, 0.1);
              `
            : css`
                display: none;
              `
        }
      >
        <div>
          <h2 className={headerClass}>Score</h2>

          <div
            className={css`
              white-space: nowrap;
              text-align: right;

              font-size: 2rem;
              margin-bottom: 16px;

              & > .score {
                font-size: 4rem;
              }
            `}
          >
            <GradeField data={data.problemSetView.totalScoreField} />
          </div>
        </div>

        <ContestViewClock data={data} />

        <h2 className={headerClass}>Problems</h2>
        <div
          className={css`
            padding: 0;
            list-style: none;
          `}
        >
          {data.problemSetView.assignmentViews.map((assignmentView, index) => (
            <NavLink
              className={css`
                overflow: hidden;

                margin: 0 -16px;
                padding: 0.5rem 16px;

                display: flex;
                flex-direction: row;
                text-decoration: none;
                color: ${Theme.colors.blue};

                &:visited {
                  color: ${Theme.colors.blue};
                }

                &:hover {
                  text-decoration: none;
                  background-color: ${Theme.colors.gray200};
                }
              `}
              activeClassName={css`
                color: ${Theme.colors.white};
                background-color: ${Theme.colors.blue};

                &:visited {
                  color: ${Theme.colors.white};
                }

                &:hover {
                  text-decoration: none;
                  background-color: ${Theme.colors.blue};
                }
              `}
              key={index}
              title={assignmentView.assignment.problem.title.variant}
              to={`/${assignmentView.assignment.problem.name}`}
            >
              <span
                className={css`
                  text-transform: uppercase;
                  margin-right: 10px;
                  white-space: nowrap;
                  overflow: hidden;
                  text-overflow: ellipsis;
                `}
              >
                {assignmentView.assignment.problem.title.variant}
              </span>
              {/* <ContestProblemScore appValence={assignmentView.totalScoreField.valence}> */}
              <span
                className={cx(
                  css`
                    white-space: nowrap;
                    margin-left: auto;
                  `,
                  badgeCss,
                  getBadgeCssByValence(assignmentView.totalScoreField.valence),
                )}
              >
                <GradeField data={assignmentView.totalScoreField} />
              </span>
            </NavLink>
          ))}
        </div>
      </aside>
    </div>
  );
}

export const contestViewAsideFragment = gql`
  fragment ContestViewAside on ContestView {
    problemSetView {
      totalScoreField {
        ...ScoreField
      }

      assignmentViews {
        assignment {
          id
          problem {
            id
            name
            title {
              ...Text
            }
          }
        }
        totalScoreField {
          ...ScoreField
        }
      }
    }

    ...ContestViewClock
  }

  ${textFragment}
  ${scoreFieldFragment}
  ${contestViewClockFragment}
`;