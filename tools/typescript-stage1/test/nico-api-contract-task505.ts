// Task505: strict consumer contract for the comment editor POST lifetime.
import {CommentSubmitLifetime} from '../nico-src/CommentSubmitLifetime';
import type {CommentSubmitPanel, CommentSubmitControl, CommentSubmitField} from '../nico-src/CommentSubmitLifetime';

declare const panel: CommentSubmitPanel;
declare const field: CommentSubmitField;
const pending: Promise<boolean> | null | undefined = CommentSubmitLifetime.submit(panel);
void pending;
void field.val().trim();
void field.val('draft').blur();
const control: CommentSubmitControl = {resolve() {}, reject(_reason?: unknown) {}};
void control;
// @ts-expect-error the submit target must provide both inputs and the event emitter
void CommentSubmitLifetime.submit({_submitPending: false});
// @ts-expect-error an input field cannot hold arbitrary server objects
void field.val({body: 'secret'});
// @ts-expect-error an async POST must not resolve to an assumed server response
const invalid: Promise<{no: number}> = CommentSubmitLifetime.submit(panel)!;
void invalid;
