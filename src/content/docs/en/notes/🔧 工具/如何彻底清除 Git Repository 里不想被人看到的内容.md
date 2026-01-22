---
title: How to Completely Remove Unwanted Content from a Git Repository
editUrl: false
slug: en/how-to-run-from-the-mess-you-made
lastUpdated: 2026-01-17T00:00:00.000Z
draft: false
banner:
  content: This content is translated by an LLM and may contain inaccuracies.
---

## Catastrophic Start

A few days ago, Noa was setting up DN42 (this article hasn't been written yet! Laziness!), and used NixOS Configuration to create a persistent, reproducible setup, casually writing a friend's peer tunnel public endpoint into the .nix file.

It looked roughly [like this](https://github.com/AsterisMono/flake/commit/38c370aa480ac673b0c5555f28083aae44a30fec):

![Pasted image 20260117143637.png](../../../../../assets/notes/附件/pasted-image-20260117143637.png)

And that's how it went peacefully for two weeks.

Until one day, while happily peering, I suddenly thought of something terrifying: wg peer tunnel endpoint seems to be some people's home wide-area public IPv6... Is it really okay to make this public?

So I asked ~~the orgy leader~~ [Cryolitia](https://github.com/Cryolitia):

![Pasted image 20260117143650.png](../../../../../assets/notes/附件/pasted-image-20260117143650.png)

I instantly felt the world was collapsing because this endpoint data had been residing in my repository for two weeks and had gone through at least two pull requests (

What to do, what to do! Encrypted data will definitely lead to configuration reconstruction, but there's no time to consider this now~ I need to think of a way to clear everyone's boxes(?) from the Git history and all corners of GitHub 🤔

## BFG Repo-Cleaner to the rescue

First, information in the git repository history needs to be handled. You can use [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) here to scan the entire git object database and then delete/replace unwanted content (well-practiced, I once naively put DMCA-able materials in the repo when I was young)

:::tip

[BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) is a tool for rapidly cleaning up Git repository history, which can be used to remove mistakenly committed large files or sensitive information.

Compared to git filter-branch, it is simpler to operate, faster, and suitable for trimming the repository or deleting content that shouldn't be retained in history.

:::

### Clone a Bare Repository

```console
❯ git clone --mirror https://github.com/AsterisMono/flake flake-bfg
Cloning into bare repository 'flake-bfg'...
remote: Enumerating objects: 6385, done.
remote: Counting objects: 100% (583/583), done.
remote: Compressing objects: 100% (117/117), done.
remote: Total 6385 (delta 504), reused 488 (delta 465), pack-reused 5802 (from 3)
Receiving objects: 100% (6385/6385), 65.82 MiB | 806.00 KiB/s, done.
Resolving deltas: 100% (3709/3709), done.
```

### Remove Confidential Information

You can write the unwanted information into a text file, one per line. BFG Repo-Cleaner will automatically replace the text to be processed with `***REMOVED***`.

```console
❯ , bfg --replace-text '/home/cmiki/Projects/flake/clear.txt' flake-bfg

Using repo : /home/cmiki/Projects/flake-bfg

Found 133 objects to protect
Found 17 commit-pointing refs : HEAD, refs/heads/feat/encrypt-peers, refs/heads/main, ...

Protected commits
-----------------

These are your protected commits, and so their contents will NOT be altered:

 * commit 3b7a0e08 (protected by 'HEAD') - contains 1 dirty file :
        - nixosModules/services/dn42.nix (10.5 KB)

WARNING: The dirty content above may be removed from other commits, but as
the *protected* commits still use it, it will STILL exist in your repository.

Details of protected dirty content have been recorded here :

/home/cmiki/Projects/flake-bfg.bfg-report/2025-09-19/21-58-53/protected-dirt/

If you *really* want this content gone, make a manual commit that removes it,
and then run the BFG on a fresh copy of your repo.

Cleaning
--------

Found 1284 commits
Cleaning commits:       100% (1284/1284)
Cleaning commits completed in 189 ms.

Updating 6 Refs
---------------

        Ref                             Before     After
        ---------------------------------------------------
        refs/heads/feat/encrypt-peers | a64ee71f | d6d2d3d5
        refs/heads/main               | 3b7a0e08 | 0783547a
        refs/pull/10/head             | ebe6249a | 87325bf1
        refs/pull/12/head             | 841bb42e | ad1f16bf
        refs/pull/13/head             | 9b4597d2 | 2a3ec8a8
        refs/pull/14/head             | a64ee71f | d6d2d3d5

...Ref update completed in 7 ms.

Commit Tree-Dirt History
------------------------

        Earliest                                              Latest
        |                                                          |
        .....................................................DDDDDDD

        D = dirty commits (file tree fixed)
        m = modified commits (commit message or parents changed)
        . = clean commits (no changes to file tree)

                                Before     After
        -------------------------------------------
        First modified commit | 585c53e7 | 34e2c950
        Last dirty commit     | 972f0f8e | 863ad3a6

Changed files
-------------

        Filename        Before & After
        -------------------------------------------------------------
        dn42.nix      | 4df9ef15 ⇒ 08173ad0, 0aa5ca1a ⇒ e6c0b5bd, ...
        dn42Peers.nix | cffbe5fa ⇒ e6817da3
        ivy.nix       | c8d5ebc1 ⇒ 0da6b2c1, 82a020d3 ⇒ eac08e03, ...
        options.nix   | dcb45556 ⇒ 8ca7c77a

In total, 299 object ids were changed. Full details are logged here:

        /home/cmiki/Projects/flake-bfg.bfg-report/2025-09-19/21-58-53

BFG run is complete! When ready, run: git reflog expire --expire=now --all && git gc --prune=now --aggressive
❯ cd flake-bfg
❯ git reflog expire --expire=now --all && git gc --prune=now --aggressive
Enumerating objects: 6388, done.
Counting objects: 100% (6388/6388), done.
Compressing objects: 100% (6120/6120), done.
Writing objects: 100% (6388/6388), done.
Selecting bitmap commits: 1237, done.
Building bitmaps: 100% (117/117), done.
Total 6388 (delta 3758), reused 2402 (delta 0), pack-reused 0 (from 0 packages)
```

### Push Back to Upstream

```console
❯ git push
Enumerating objects: 6388, done.
Writing objects: 100% (6388/6388), 65.69 MiB | 5.87 MiB/s, done.
Total 6388 (delta 0), reused 0 (delta 0), pack-reused 6388 (from 1 package)
remote: Resolving deltas: 100% (3758/3758), done.
To https://github.com/AsterisMono/flake
 + a64ee71...d6d2d3d feat/encrypt-peers -> feat/encrypt-peers (forced update)
 + 3b7a0e0...0783547 main -> main (forced update)
 ! [remote rejected] refs/pull/1/head -> refs/pull/1/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/10/head -> refs/pull/10/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/11/head -> refs/pull/11/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/12/head -> refs/pull/12/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/13/head -> refs/pull/13/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/14/head -> refs/pull/14/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/2/head -> refs/pull/2/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/3/head -> refs/pull/3/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/4/head -> refs/pull/4/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/5/head -> refs/pull/5/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/6/head -> refs/pull/6/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/7/head -> refs/pull/7/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/8/head -> refs/pull/8/head (deny updating a hidden ref)
 ! [remote rejected] refs/pull/9/head -> refs/pull/9/head (deny updating a hidden ref)
Error: could not push some refs to 'https://github.com/AsterisMono/flake'
```

The treated bare repository updates all refs on the remote when pushed. Here you can see some refs have been rejected for update. What are they?

According to the discussion in this [Issue](https://github.com/rtyley/bfg-repo-cleaner/issues/484):

> From my understanding this is because GitHub/GitLab still has references to the old commits in any pull requests.
>
> Even though BFG has rewritten the commits, GitHub still has read-only refs for the old commits in pull requests.

GitHub retains read-only copies of commits in each Pull Request; these replicas exist as refs in the repository and are not writable even with force push, making it impossible to eradicate traces.

Unluckily, my DN42 configuration part was merged using Pull Requests (so I had to seek help from GitHub Support

## Request GitHub Support to Remove Pull Request

:::note

The premise is that the target must be content within a repository you (or your organization) control to initiate a deletion request.

:::

[GitHub Support (why is this website in Chinese?)](https://support.github.com/) -> My requests -> New request -> Remove data from a repository I own or manage -> Delete pull request

You'll encounter a fun virtual agent here (looks like LLM but isn't a bot) who will ask you the following questions:

* How many PRs need to be removed? Single or multiple?
* From which repository should they be removed? Which PRs (PR numbers) should be removed?
* Have you cleaned the sensitive data from git history (we have completed this)? Or, has the sensitive data been rotated?
* Has cleaning git history and rotating/expiring sensitive data resolved your issue?
* (If not) Why do you need this PR completely removed?

Once completed, a Support Ticket will be created instantly, and there's no need to write a lengthy essay. The experience is very smooth.

![Pasted image 20260117143709.png](../../../../../assets/notes/附件/pasted-image-20260117143709.png)

:::caution

GitHub Support **does not support** Firefox.

Although they didn't indicate unsupported browsers, the virtual agent and regular ticket submission buttons are **unusable**.

:::

GitHub Support Staff responds very quickly, usually within ten minutes, asking you to submit additional commit hashes that initially introduced sensitive data so they can perform extra scans to ensure your sensitive data is permanently removed from GitHub:

> If you are trying to remove a sensitive commit from GitHub, and that commit is referenced anywhere else, such as in another pull request, branch or tag, it won't be garbage collected after I delete the pull request.
>
> Before I delete the pull requests, can you find the full SHA of the commit that originally introduced the sensitive data? I can then run a thorough check to make sure it is not referenced anywhere and we can successfully remove it from GitHub.
>
> \[...] If you don't provide me with a SHA, I can proceed with deleting the pull request, but I can't guarantee that any sensitive commits will be successfully garbage collected away.

Once the SHA is provided, the staff will work for a short while and then tell you that they have scanned PR references with the provided SHA. Usually, the references found match the PR you want to delete. Then, you'll be given two choices:

* Completely delete the entire pull request, including conversations, reviews, and file diffs
* Only delete file references, which will remove file diffs but preserve the conversation history within the PR

Since my repository is only used by me, I confidently opted for direct deletion. If it were a community project, I might consider the second option.

A while later, you'll find the specified PR has mysteriously vanished, and trying to open it using its numbered link will show a 404 error.

> Alright! I’ve deleted the PRs and performed cache clearance and garbage collection on the repository.
>
> Have a great weekend, and feel free to reach out again if you need anything else!

Finally, I can sleep well, not worrying about my friends getting compromised because of my public repository (

## So, What Now? What About the Data That Needs Encryption?

For a long time, the only recommended method for encrypting data in Nix Configuration was: `sops-nix`.

Maybe also `agenix`, but both solutions share a common trait: decrypting at runtime, making it impossible to release plaintext during eval.

However, the `dn42Peers.nix` file contains peer information used in the configurations of many machines. It's embedded in multiple NixOS Module configs, not all of which support secret template overriding. Even if they all did, the modification costs would be substantial.

So, in the end (shamefully), I opted to use [git-agecrypt](https://github.com/vlaci/git-agecrypt) to encrypt this file at the git level. The original project states:

> Why should I use this?
>
> Short answer: you probably shouldn't.
>
> \[...] The one use-case where it makes sense to use git-agecrypt instead is when you want to keep some files secret on a (potentially public) git remote, but you need to have the plaintext in the local working tree because you cannot hook into the above tools for your workflow. Being lazy is not an excuse to use this software.

The cost is that the system closure can no longer be hosted by a public binary cache host. Moreover, the system closure feels dirty (contaminated by secrets...)

This is not a very perfect solution. Maybe I'll think about it more later?
