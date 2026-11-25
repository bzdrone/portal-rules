# portal-rules

Converts Battlefield 6 Portal block rules into TypeScript scripts for the Portal scripting API (`mod.*` and `modlib`).

Status: early. It converts the three official Custom* templates (Conquest, Breakthrough, Rush) and the output type-checks
against the SDK typings.

This is an unofficial community project. It is not affiliated with or endorsed by Electronic Arts or DICE. Battlefield and
Portal are trademarks of Electronic Arts. This repository contains no EA code, SDK files, templates or exports.

**Who is this for?** There are two kinds of user:

| I want to... | Go to |
|---|---|
| **Turn my block rules into a script** (just use it) | [Export a script](#export-a-script) below |
| **Add features or fix the converter** | [CONTRIBUTING.md](CONTRIBUTING.md) |

## Export a script

You need [Node.js](https://nodejs.org) 22 or newer and the Battlefield 6 Portal SDK. The SDK is only read for the list of
block and event names; nothing from it is copied.

1. **Export your experience.** In the Portal web builder, go to your list of experiences (the **Custom** tab), click the
   **⋮** (three dots) on your experience and choose **Export**. It saves a `.json` file (named like `my-experience_experience.json`). A full experience
   export from the SDK's Godot editor (`*_bundle.json`) and a plain workspace `.json` also work.
2. **Get this tool.** Download or clone this repository, open a terminal in its folder, and run:

   ```sh
   npm install
   ```

3. **Convert.** Give it your file, and add `--sdk` with the SDK folder unless the SDK is in `C:/PortalSDK`:

   ```sh
   npm run convert -- "C:\Users\me\Downloads\my-experience_experience.json" --sdk "C:\path\to\PortalSDK"
   ```

   To avoid typing `--sdk` every time, set the `PORTAL_SDK` environment variable to the SDK folder once.

4. **Use the result.** Next to your file (or in the folder you pass with `--out <folder>`) you get:

   - `my-experience_experience.ts`: the script
   - `my-experience_experience.strings.json`: the strings

   In the web builder, add them on the **Rules Editor > Script** page ("Create new Script file" and "Create new Strings
   file").

Optional check that the script compiles against the SDK typings:

```sh
npm run typecheck:out -- "C:\Users\me\Downloads\my-experience_experience.ts"
```

The converter prints a warning for anything it did not recognise. If some text in the result is `#`, the web builder's
profanity filter probably masked it when your experience was saved (it turned a flag letter `F` into `#` in our test); correct
the text in the editor and export again. Treat the output like any generated code and test it in a
copy of your experience first. Known differences from EA's own exporter are listed in
[docs/divergences.md](docs/divergences.md); behaviour we infer rather than know is in
[docs/portal-behavior.md](docs/portal-behavior.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md): setup, tests, project layout and how the comparison against EA's exporter works.

## License

[MIT](LICENSE). This covers this repository only, not the Portal SDK or any EA content you use with it.
