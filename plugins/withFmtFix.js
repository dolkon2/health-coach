/**
 * withFmtFix — Expo config plugin.
 *
 * React Native's bundled `fmt` library fails to compile on Xcode 16+ with
 * "call to consteval function ... is not a constant expression". The
 * documented workaround is to disable fmt's consteval path by defining
 * FMT_USE_CONSTEVAL=0 in the fmt pod's preprocessor defines.
 *
 * This plugin appends that fix to the Podfile's post_install block on every
 * `expo prebuild`, so the patch survives native folder regeneration.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# FMT_USE_CONSTEVAL fix (Xcode 16+)';

const FMT_BLOCK = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |config|
          defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] || ['$(inherited)']
          defs = [defs] unless defs.is_a?(Array)
          defs << 'FMT_USE_CONSTEVAL=0' unless defs.include?('FMT_USE_CONSTEVAL=0')
          config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
        end
      end
    end`;

function withFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) return cfg;

      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (contents.includes(MARKER)) return cfg;

      // Inject just before the closing `end` of the post_install block.
      const re = /(post_install do \|installer\|[\s\S]*?)(\n  end\s*$)/m;
      if (re.test(contents)) {
        contents = contents.replace(re, `$1${FMT_BLOCK}$2`);
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
}

module.exports = withFmtFix;
