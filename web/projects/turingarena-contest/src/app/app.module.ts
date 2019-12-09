// tslint:disable-next-line: no-submodule-imports
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule, Routes } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { NgxFilesizeModule } from 'ngx-filesize';
import { MarkdownModule } from 'ngx-markdown';

import { AppComponent } from './app.component';
import { BypassSanitizerPipe } from './bypass-sanitizer.pipe';
import { ContestViewComponent } from './contest-view/contest-view.component';
import { EmptyComponent } from './empty.component';
import { FileVariantPipe } from './file-variant.pipe';
import { GraphQLModule } from './graphql.module';
import { RelativeTimeComponent } from './relative-time/relative-time.component';
import { SubmissionDialogComponent } from './submission-dialog/submission-dialog.component';
import { SubmitDialogComponent } from './submit-dialog/submit-dialog.component';
import { TextVariantPipe } from './text-variant.pipe';

const routes: Routes = [
  {
    path: '',
    component: ContestViewComponent,
    children: [
      {
        path: '',
        component: EmptyComponent,
      },
      {
        path: 'problem/:problemName',
        component: EmptyComponent,
      },
    ],
  },
];

@NgModule({
  declarations: [
    AppComponent,
    RelativeTimeComponent,
    SubmitDialogComponent,
    SubmissionDialogComponent,
    BypassSanitizerPipe,
    TextVariantPipe,
    ContestViewComponent,
    FileVariantPipe,
    EmptyComponent,
  ],
  imports: [
    BrowserModule,
    GraphQLModule,
    HttpClientModule,
    NgxFilesizeModule,
    NgbModule,
    FontAwesomeModule,
    MarkdownModule.forRoot(),
    RouterModule.forRoot(routes, {
      enableTracing: true,
      anchorScrolling: 'enabled',
      scrollPositionRestoration: 'enabled',
    }),
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule { }
