from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from .models import SourceDocument
from .repositories import SourceRepository


SOURCE_ROWS: list[tuple[str, str, str, str | None, str]] = [
    (
        "slack_message",
        "Maria Chen",
        "disputes-ops-101",
        "For unauthorized card claims under $50, I usually just issue provisional credit when the account is over 90 days old. No reason to make a good customer wait.",
        "2026-05-04T13:12:00+00:00",
    ),
    (
        "slack_message",
        "Leon Brooks",
        "disputes-ops-102",
        "Reminder: anything above $500 goes to manual review and needs a disputes lead. Please don't auto-credit those even when the story looks clean.",
        "2026-05-05T15:44:00+00:00",
    ),
    (
        "slack_message",
        "Nina Patel",
        "friendly-fraud-12",
        "If it's friendly fraud and this is their third dispute, deny it. Two prior similar claims is the repeat-offender line the risk team uses.",
        "2026-05-06T18:09:00+00:00",
    ),
    (
        "slack_message",
        "Jonas Klein",
        "regional-rules-4",
        "EU cardholders get 60 days from the transaction to raise the dispute. The 30-day queue rule is for US accounts, not EU.",
        "2026-05-07T09:26:00+00:00",
    ),
    (
        "slack_message",
        "Priya Raman",
        "disputes-ops-103",
        "New account plus meaningful dollars is the risky combo. If the account is under 30 days and the claim is over $100, route it to risk review.",
        "2026-05-07T16:18:00+00:00",
    ),
    (
        "slack_message",
        "Mateo Ruiz",
        "provisional-credit-9",
        "For mature accounts, unauthorized claims from $50 through $500 can still get provisional credit if filed within 30 days, but a risk analyst must sign off.",
        "2026-05-08T12:55:00+00:00",
    ),
    (
        "slack_message",
        "Amy Okafor",
        "duplicate-charge-21",
        "Duplicate charge cases under $150 should go back to the merchant first. Ask for merchant contact before we credit it ourselves.",
        "2026-05-09T14:07:00+00:00",
    ),
    (
        "slack_message",
        "Omar Haddad",
        "regional-rules-4",
        "I found an old macro saying EU is 45 days. Pretty sure that's stale after last quarter's change, but flagging the inconsistency.",
        "2026-05-10T10:41:00+00:00",
    ),
    (
        "slack_message",
        "Elise Martin",
        "atm-claims-8",
        "ATM cash-not-received claims need an ATM ops lead, regardless of amount. We have to reconcile the terminal before making a call.",
        "2026-05-11T17:22:00+00:00",
    ),
    (
        "slack_message",
        "Sam Wilson",
        "provisional-credit-9",
        "The sub-$50 mature-account path is truly automatic. We don't request receipts for those unauthorized claims.",
        "2026-05-12T11:03:00+00:00",
    ),
    (
        "slack_message",
        "Tasha Green",
        "disputes-ops-102",
        "Saw a $740 claim auto-credited yesterday. Please reverse that workflow: over $500 always means manual review plus lead approval.",
        "2026-05-13T15:36:00+00:00",
    ),
    (
        "slack_message",
        "Jamie Park",
        "friendly-fraud-12",
        "Risk confirmed the repeat-friendly-fraud rule: two previous similar disputes means deny the new one, not another goodwill credit.",
        "2026-05-14T19:11:00+00:00",
    ),
    (
        "slack_message",
        "Alex Moreau",
        "regional-rules-5",
        "Confirmed with compliance this morning: EU filing window is 60 calendar days. Updated macros should use 60.",
        "2026-05-15T08:48:00+00:00",
    ),
    (
        "slack_message",
        "Nikhil Shah",
        "provisional-credit-10",
        "A $50-$500 unauthorized claim from an account older than 90 days is okay for provisional credit within 30 days once a risk analyst approves.",
        "2026-05-15T13:59:00+00:00",
    ),
    (
        "slack_message",
        "Jo Freeman",
        "card-present-6",
        "Card-present unauthorized claims can still be real, but don't use the tiny-claim shortcut if device evidence conflicts. Send those to an analyst.",
        "2026-05-16T16:28:00+00:00",
    ),
    (
        "slack_message",
        "Ren Ito",
        "filing-window-3",
        "When a claim is outside the regional filing window, don't improvise a denial. Escalate to a human for a limitations check.",
        "2026-05-17T12:16:00+00:00",
    ),
    (
        "ticket",
        "Case 88421 / D. Gomez",
        "ticket-88421",
        "Unauthorized $38 purchase; account age 417 days. Agent issued provisional credit immediately and noted 'under-50 mature account path.' QA: pass.",
        "2026-05-18T14:31:00+00:00",
    ),
    (
        "ticket",
        "Case 88477 / K. Singh",
        "ticket-88477",
        "Unauthorized amount $320, account age 200 days, reported after 15 days. Risk analyst approved provisional credit. QA found handling consistent with team practice.",
        "2026-05-19T09:52:00+00:00",
    ),
    (
        "ticket",
        "Case 88502 / L. James",
        "ticket-88502",
        "$612 unauthorized purchase was held for manual review. Disputes lead approval recorded before customer response.",
        "2026-05-19T17:04:00+00:00",
    ),
    (
        "ticket",
        "Case 88531 / E. Ross",
        "ticket-88531",
        "Customer admitted household member made purchase; two earlier same-merchant friendly-fraud claims were found. Claim denied as repeat friendly fraud.",
        "2026-05-20T16:46:00+00:00",
    ),
    (
        "ticket",
        "Case 88610 / M. Weber",
        "ticket-88610",
        "EU customer filed 54 days after transaction. Intake accepted the dispute under the 60-day EU window.",
        "2026-05-21T10:18:00+00:00",
    ),
    (
        "ticket",
        "Case 88644 / S. Davis",
        "ticket-88644",
        "Account age 12 days; $188 unauthorized claim. Agent routed to risk review and requested disputes lead approval rather than issuing credit.",
        "2026-05-22T13:40:00+00:00",
    ),
    (
        "ticket",
        "Case 88689 / P. Young",
        "ticket-88689",
        "$82 duplicate subscription charge. Customer had not contacted merchant, so agent requested merchant contact before further action.",
        "2026-05-23T18:02:00+00:00",
    ),
    (
        "ticket",
        "Case 88714 / A. Laurent",
        "ticket-88714",
        "US customer filed after 47 days. Agent escalated because the case was outside the usual 30-day handling window; no automated denial was issued.",
        "2026-05-24T11:24:00+00:00",
    ),
    (
        "ticket",
        "Case 88782 / R. Brown",
        "ticket-88782",
        "ATM dispensed no cash but account was debited $60. Routed to ATM operations lead for terminal reconciliation.",
        "2026-05-25T15:15:00+00:00",
    ),
    (
        "ticket",
        "Case 88809 / T. Evans",
        "ticket-88809",
        "$24 unauthorized digital purchase, 2-year-old account. Immediate provisional credit; zero approvals attached. QA: pass.",
        "2026-05-26T09:37:00+00:00",
    ),
    (
        "ticket",
        "Case 88855 / N. Cole",
        "ticket-88855",
        "$499 unauthorized purchase, account age 180 days, reported day 22. Risk analyst approved provisional credit.",
        "2026-05-27T14:58:00+00:00",
    ),
    (
        "ticket",
        "Case 88891 / C. Moore",
        "ticket-88891",
        "$1,240 claim held in manual review. Notes say values above $500 require a disputes lead even when the account is established.",
        "2026-05-28T16:33:00+00:00",
    ),
    (
        "ticket",
        "Case 88927 / I. King",
        "ticket-88927",
        "Third household-use dispute in six months. Classified as friendly fraud and denied after the two prior claims were linked.",
        "2026-05-29T12:08:00+00:00",
    ),
    (
        "ticket",
        "Case 88963 / V. Costa",
        "ticket-88963",
        "EU dispute submitted at day 59. Accepted for investigation; case note cites the current 60-calendar-day regional window.",
        "2026-05-30T10:29:00+00:00",
    ),
    (
        "ticket",
        "Case 89004 / H. Scott",
        "ticket-89004",
        "Account opened 21 days ago; unauthorized claim for $260. Risk manual review started before any credit decision.",
        "2026-05-31T17:42:00+00:00",
    ),
    (
        "ticket",
        "Case 89048 / B. Lee",
        "ticket-89048",
        "$130 duplicate charge. Merchant outreach requested first. Merchant later refunded, so no platform credit was needed.",
        "2026-06-01T14:06:00+00:00",
    ),
    (
        "doc",
        "Disputes Playbook (working draft)",
        "playbook-v7-section-2",
        "Observed handling standard: unauthorized claims below $50 may receive automatic provisional credit when account tenure is at least 90 days. No approval is normally recorded.",
        "2026-06-02T09:00:00+00:00",
    ),
    (
        "doc",
        "QA Calibration Notes",
        "qa-calibration-may",
        "For unauthorized claims from $50 to $500, mature accounts (90+ days) reported within 30 days receive provisional credit after risk analyst approval.",
        "2026-06-02T09:15:00+00:00",
    ),
    (
        "doc",
        "Disputes Escalation Matrix",
        "escalation-matrix-v3",
        "All dispute values above $500: manual review required. Mandatory approver: disputes lead. This threshold overrides low-risk customer indicators.",
        "2026-06-02T09:30:00+00:00",
    ),
    (
        "doc",
        "Risk Pattern Brief",
        "risk-patterns-q2",
        "Friendly-fraud cases with two or more prior similar disputes are treated as repeat behavior and denied. Record linked prior case identifiers.",
        "2026-06-02T09:45:00+00:00",
    ),
    (
        "doc",
        "Regional Intake Addendum",
        "regional-addendum-2026-04",
        "EU disputes are eligible for intake for 60 calendar days after the transaction. Supersedes the retired 45-day macro. Standard US operations window remains 30 days.",
        "2026-06-02T10:00:00+00:00",
    ),
    (
        "doc",
        "New Account Controls",
        "new-account-controls-v2",
        "Claims above $100 on accounts younger than 30 days require manual risk review and disputes lead approval before credit.",
        "2026-06-02T10:15:00+00:00",
    ),
    (
        "doc",
        "Duplicate Billing Runbook",
        "duplicate-billing-v4",
        "For duplicate charges of $150 or less, request that the customer contact the merchant before platform-funded credit is considered.",
        "2026-06-02T10:30:00+00:00",
    ),
    (
        "doc",
        "Limitations Desk Notes",
        "limitations-desk-v1",
        "Cases beyond the applicable regional filing window must be escalated to a human limitations review. Do not automatically deny solely due to age.",
        "2026-06-02T10:45:00+00:00",
    ),
]


def seed_sources(session: Session) -> int:
    repository = SourceRepository(session)
    if repository.count() > 0:
        return 0
    documents = [
        SourceDocument(
            id=f"src-{index:03d}",
            type=row[0],
            author=row[1],
            thread_id=row[2],
            text=row[3],
            timestamp=datetime.fromisoformat(row[4]),
        )
        for index, row in enumerate(SOURCE_ROWS, start=1)
    ]
    repository.add_all(documents)
    session.commit()
    return len(documents)
