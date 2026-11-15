# Changelog

## [2.0.0](https://github.com/inesiscosta/one-terminal/compare/v1.2.1...v2.0.0) (2026-11-15)


### ⚠ BREAKING CHANGES

* Arguments are parsed like a shell: `say "hi there"` passes one argument (hi there), where it used to pass two with the quotes kept. The window title now ends with the current directory by default; set windowChrome.titleBarCwd to "none" to keep the old title.

### Features

* add sort and uniq, and read stdin from - in file commands ([4bde9f6](https://github.com/inesiscosta/one-terminal/commit/4bde9f660fcde36f6652718e1fe9d893a224348e))
* announce terminal output to screen readers ([83a2ebf](https://github.com/inesiscosta/one-terminal/commit/83a2ebfb2f6cd3f77b32865708227f014c470689))
* chain commands with &&, || and ;, with exit statuses and $? ([cf22d3c](https://github.com/inesiscosta/one-terminal/commit/cf22d3c2392048977aa37da5f308f48a63e61661))
* let disabledCommands turn off any built-in ([d4ff629](https://github.com/inesiscosta/one-terminal/commit/d4ff6292be784e2c09a2c177f703f9f589972c4c))
* **ls:** show human-readable sizes with -h ([be63c85](https://github.com/inesiscosta/one-terminal/commit/be63c855d7dae3f11bc111f4e99be4f36fe033f3))
* prefix shell errors with a configurable shell name ([60351c6](https://github.com/inesiscosta/one-terminal/commit/60351c656e48ab1249d4955d3b826459a7d52fe8))
* rebuild the command engine with pipes, flags and new built-ins ([65e39cc](https://github.com/inesiscosta/one-terminal/commit/65e39cc72b9cdea5548d265b41f2f2eda394c240))
* **shell:** add a quote-aware command line parser ([c315983](https://github.com/inesiscosta/one-terminal/commit/c3159838b89ac83d6c973432feaf24d4b7610512))
* support async extra commands with Ctrl+C cancellation ([7e0aaa6](https://github.com/inesiscosta/one-terminal/commit/7e0aaa666bdd53a0326816841de505aea2f4c2fd))


### Bug Fixes

* **build:** stop listing the root as a workspace package ([5e9924d](https://github.com/inesiscosta/one-terminal/commit/5e9924d33d36606db4cb3e9d437c471d7bd2bf29))
* keep pipeline stages from changing the session ([7394493](https://github.com/inesiscosta/one-terminal/commit/73944934712d78d60639329cce806688a0bce934))
* remove the styles.css export that was never built ([21f4e53](https://github.com/inesiscosta/one-terminal/commit/21f4e5326dabbf7239709f2d714971edcb948aef))
* **shell:** keep a trailing backslash instead of dropping it ([93f3872](https://github.com/inesiscosta/one-terminal/commit/93f387252c4f75a00a659eae3e9d4da30490f18e))
