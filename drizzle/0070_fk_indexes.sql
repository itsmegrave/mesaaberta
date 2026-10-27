CREATE INDEX "gm_invite_blocks_gm_idx" ON "gm_invite_blocks" USING btree ("gm_id");--> statement-breakpoint
CREATE INDEX "messages_table_idx" ON "messages" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "notifications_actor_idx" ON "notifications" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "partner_invitations_inviter_idx" ON "partner_invitations" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "place_claims_claimant_idx" ON "place_claims" USING btree ("claimant_id");--> statement-breakpoint
CREATE INDEX "poll_votes_profile_idx" ON "poll_votes" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "ratings_player_idx" ON "ratings" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "reports_subject_idx" ON "reports" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "reports_table_idx" ON "reports" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX "user_badges_granted_by_idx" ON "user_badges" USING btree ("granted_by");--> statement-breakpoint
CREATE INDEX "widget_dismissals_profile_idx" ON "widget_dismissals" USING btree ("profile_id");