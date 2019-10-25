import { Component } from '@angular/core';
import { ContestQueryService } from './contest-query.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SubmitDialogComponent } from './submit-dialog/submit-dialog.component';
import { DomSanitizer } from '@angular/platform-browser';
import { map } from 'rxjs/operators';
import { ContestQuery_problems as ContestProblem } from './__generated__/ContestQuery';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(
    private contestQueryService: ContestQueryService,
    private modal: NgbModal,
    private sanitizer: DomSanitizer,
  ) { }

  contestQuery = this.contestQueryService.watch({
    userId: 'test' // FIXME
  }, {
      pollInterval: 10000,
    });

  selectedProblemName?: string = undefined;

  stateObservable = this.contestQuery.valueChanges.pipe(
    map(({ data }) => {
      if (data === undefined) { return undefined; }

      const { problems } = data;

      const getProblemState = (problem: ContestProblem) => {
        const { scorables } = problem.material;
        return {
          score: scorables
            .map((scorable) => problem.scorables.find((s) => s.scorableId === scorable.name))
            .map((scorable) => scorable && scorable.score || 0)
            .reduce((a, b) => a + b, 0),
          maxScore: scorables.map(s => s.range.max).reduce((a, b) => a + b, 0),
          precision: scorables.map(s => s.range.precision).reduce((a, b) => Math.max(a, b), 0),
        };
      };

      const problemsState = problems.map(getProblemState);

      return {
        score: problemsState.map((s) => s.score).reduce((a, b) => a + b, 0),
        maxScore: problemsState.map((s) => s.maxScore).reduce((a, b) => a + b, 0),
        precision: problemsState.map((s) => s.precision).reduce((a, b) => Math.max(a, b), 0),
        getProblemState,
      };
    })
  );

  async openSubmitDialog() {
    const modalRef = this.modal.open(SubmitDialogComponent);
    const modal = modalRef.componentInstance as SubmitDialogComponent;

    modal.appComponent = this;
    modal.problemName = this.selectedProblemName;

    try {
      await modalRef.result;
    } catch (e) {
      // dismissed, do nothing
    }
  }

  getDataURL(statement) {
    return this.sanitizer.bypassSecurityTrustUrl('data:' + statement.type + ';base64,' + statement.content.base64);
  }
}
