# The privacy policy of the WhyMail app

WhyMail is an Android app. Its privacy policy is published on this site, at `/whymail/datenschutz/`
(English first, German second and legally binding), because the Google Play Console needs a public
address and the publisher of the app owns this domain. The address is entered in the Play Console, so
it never changes.

The text is written in the repository of the app (`docs/legal/privacy-policy.md`, private). This
folder holds what this site needs from it:

| File                          | What it is                                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `privacy-policy.upstream.md`  | A copy of the **published part** of that file (from `# Datenschutzerklärung WhyMail` on), byte for byte. The notes for the team above it are not copied. |
| `privacy-policy.mdx`          | The page, made from the copy. Do not edit it by hand.                                                                                                   |

The personal details of the publisher are not in the text. The name and the address come from the
build variables of the site and are drawn by CSS, like in the legal notice, so they are not in the HTML
as text. The email address of the app is public in the store and is shown through the same protection as
the email address of this site. The phone number is not published; a link to the legal notice takes its
place.

## Commands

```bash
pnpm whymail-policy sync <path to docs/legal/privacy-policy.md>   # take a new version, then read `git diff` and commit
pnpm whymail-policy check <path to docs/legal/privacy-policy.md>  # only compare: prints changed=true or changed=false
pnpm whymail-policy build                                         # make the page again from the copy
```

The conversion (`src/lib/whymail-policy.ts`) is strict: it stops at a placeholder, an email address or a
line in the paragraph with the publisher that it does not know, and nothing is written then. The tests
check the conversion, that the page is what the script makes from the copy, and that the page has both
languages with the same sections.

## The daily check

The workflow `.github/workflows/whymail-policy.yml` runs once a day. It reads the file of the app with a
read-only deploy key, compares the published part with the copy and opens an issue when they differ.
Nothing is published automatically: the maintainer reads the change, checks it against the build that
the testers get, and merges the update. The issue contains no text of the policy, only two hashes,
because this repository is public.
