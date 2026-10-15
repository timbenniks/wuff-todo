# Todoist reference research

Reviewed: October 15, 2026

Purpose: identify useful task-management patterns and future possibilities, not define feature parity.

## Findings

Todoist combines quick natural-language capture with projects, descriptions, labels, priorities, sections, subtasks, recurring dates, Today/Upcoming views, filters, and multiple layouts. Collaboration includes shared projects, assignment, comments, and attachments. Its useful product pattern is progressive detail: start with a short task and organize it later.

Source: [Todoist features](https://www.todoist.com/features).

## Free and paid features

| Plan     | Selected capabilities                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------- |
| Beginner | Five personal projects, three filters, list/board layouts, basic reminders, seven days of activity history |
| Pro      | 300 personal projects, 150 filters, calendar layout, durations, deadlines, custom reminders, full history  |
| Business | Team workspace, up to 500 team projects, roles, folders, shared templates, centralized billing             |

Source: [Todoist pricing](https://www.todoist.com/pricing).

The billing FAQ identifies Premium as the former name for Pro. It also lists paid time-blocking, location-based and recurring reminders, backups, project insights, and expanded AI capabilities. Shared projects are available on the free plan. Published USD prices at review time are $7/month or $60/year for Pro, and $10/user/month or $96/user/year for Business. Prices and entitlements can change.

The official pricing page and FAQ differed on the Pro attachment-size limit at review time; no attachment limit is adopted for Wuff.

Source: [Todoist plan comparison and billing FAQ](https://www.todoist.com/help/account-and-billing/plans/todoist-plans-pricing-and-billing-faq-Vq2z0HWL6).

## Wuff decisions arising from the research

Adopt simple list and task management, sharing, and consistent cross-client access first. Give Wuff its own corgi identity and interface. Do not reproduce Todoist's subscription tiers or make paid-feature parity a release requirement.

Keep these as future ideas only:

- Task details, sections, subtasks, labels, and priorities.
- Dates, reminders, recurring tasks, durations, and deadlines.
- Saved filters, boards, and calendar views.
- Assignment, comments, attachments, templates, and activity history.
- Calendar integrations and richer capture.

The initial broad feature proposal was superseded by the user's explicit preference for basic lists and ordering. The [product specification](product-spec.md) is authoritative for Wuff's scope.

If scheduling is added, distinguish a planned work date from a hard deadline, and fixed recurring schedules from intervals measured after completion. These are future design considerations, not current schema requirements.
