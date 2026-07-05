/**
 * withFmtFix — Expo config plugin.
 *
 * React Native's bundled `fmt` library fails to compile on Xcode 16+ with
 * "call to consteval function ... is not a constant expression". The
 * documented workaround is to disable fmt's consteval path by defining
 * FMT_USE_CONSTEVAL=0 in the fmt pod's preprocessor defines.
 *
 * BUT: fmt 11.0.2's base.h redefines FMT_USE_CONSTEVAL unconditionally (no
 * #ifndef guard), so the -D flag alone is a silent no-op — the redefinition
 * warning is suppressed by GCC_WARN_INHIBIT_ALL_WARNINGS. Discovered
 * 2026-07-01 when a clean build under Xcode 26.4.1 failed; earlier builds
 * only worked because fmt.o was compiled by an older, more tolerant clang.
 * The post_install block therefore ALSO patches an #ifdef guard into the
 * installed pod's base.h (idempotent) so the define actually takes effect.
 *
 * This plugin appends both fixes to the Podfile's post_install block on every
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
    end

    # fmt 11.0.2 redefines FMT_USE_CONSTEVAL unconditionally, clobbering the
    # -D flag above. Guard the detection block so the flag wins (idempotent).
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      src = File.read(fmt_base)
      unguarded = "// Detect consteval, C++20 constexpr extensions and std::is_constant_evaluated.\\n#if !defined(__cpp_lib_is_constant_evaluated)"
      guarded = "// Detect consteval, C++20 constexpr extensions and std::is_constant_evaluated.\\n#ifdef FMT_USE_CONSTEVAL\\n// Respect a value provided via compiler flags (-DFMT_USE_CONSTEVAL=0).\\n#elif !defined(__cpp_lib_is_constant_evaluated)"
      if src.include?(unguarded)
        File.chmod(0644, fmt_base)
        File.write(fmt_base, src.sub(unguarded, guarded))
        Pod::UI.puts 'withFmtFix: guarded FMT_USE_CONSTEVAL in fmt base.h'
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
