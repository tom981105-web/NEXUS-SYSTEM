/**
 * ART ARCHIVE SYSTEM -> NEXUS migration adapter
 *
 * Purpose
 * - Keep automation-status.json in tom981105-web/art-archive because the public archive reads it.
 * - Write SYSTEM-only telemetry to tom981105-web/NEXUS-SYSTEM/systems/art-archive/.
 *
 * Security
 * - Do not hard-code a GitHub token in this file.
 * - Reuse the token already stored in Script Properties.
 */

const NEXUS_ART_SYSTEM_TARGET = Object.freeze({
  owner: 'tom981105-web',
  repo: 'NEXUS-SYSTEM',
  branch: 'main',
  basePath: 'systems/art-archive'
});

const ART_PUBLIC_TARGET = Object.freeze({
  owner: 'tom981105-web',
  repo: 'art-archive',
  branch: 'main'
});

const NEXUS_SYSTEM_FILES = new Set([
  'system-status.json',
  'system-events.json',
  'system-history.json',
  'system-usage.json'
]);

function getGithubTokenForNexus_() {
  const props = PropertiesService.getScriptProperties();
  const candidates = [
    'GITHUB_TOKEN',
    'GITHUB_PAT',
    'GH_TOKEN',
    'GITHUB_API_TOKEN'
  ];
  for (const key of candidates) {
    const value = props.getProperty(key);
    if (value) return value;
  }
  throw new Error('GitHub token not found in Script Properties.');
}

function githubApiRequest_(url, options) {
  const token = getGithubTokenForNexus_();
  const params = Object.assign({
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  }, options || {});

  const response = UrlFetchApp.fetch(url, params);
  const code = response.getResponseCode();
  const text = response.getContentText();

  if (code < 200 || code >= 300) {
    throw new Error('GitHub API ' + code + ': ' + text.slice(0, 500));
  }
  return text ? JSON.parse(text) : {};
}

function githubReadFileMeta_(target, path) {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url =
    'https://api.github.com/repos/' +
    encodeURIComponent(target.owner) + '/' +
    encodeURIComponent(target.repo) +
    '/contents/' + encodedPath +
    '?ref=' + encodeURIComponent(target.branch);

  try {
    return githubApiRequest_(url, { method: 'get' });
  } catch (err) {
    if (String(err).indexOf('GitHub API 404') !== -1) return null;
    throw err;
  }
}

function githubWriteJson_(target, path, data, message) {
  const current = githubReadFileMeta_(target, path);
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url =
    'https://api.github.com/repos/' +
    encodeURIComponent(target.owner) + '/' +
    encodeURIComponent(target.repo) +
    '/contents/' + encodedPath;

  const body = {
    message: message,
    content: Utilities.base64Encode(
      JSON.stringify(data, null, 2),
      Utilities.Charset.UTF_8
    ),
    branch: target.branch
  };
  if (current && current.sha) body.sha = current.sha;

  return githubApiRequest_(url, {
    method: 'put',
    contentType: 'application/json',
    payload: JSON.stringify(body)
  });
}

/**
 * Drop-in writer for the existing ART automation.
 *
 * Existing calls that write a SYSTEM file can be changed to:
 *   writeArtSystemJson_('system-status.json', payload, 'Update SYSTEM runtime status');
 *
 * automation-status.json is intentionally kept in art-archive.
 */
function writeArtSystemJson_(fileName, payload, commitMessage) {
  if (fileName === 'automation-status.json') {
    return githubWriteJson_(
      ART_PUBLIC_TARGET,
      fileName,
      payload,
      commitMessage || 'Update automation status'
    );
  }

  if (!NEXUS_SYSTEM_FILES.has(fileName)) {
    throw new Error('Unsupported ART SYSTEM file: ' + fileName);
  }

  return githubWriteJson_(
    NEXUS_ART_SYSTEM_TARGET,
    NEXUS_ART_SYSTEM_TARGET.basePath + '/' + fileName,
    payload,
    commitMessage || ('Update ART SYSTEM ' + fileName)
  );
}

/**
 * Convenience wrappers for minimal changes in the current script.
 */
function writeSystemStatusToNexus_(payload) {
  return writeArtSystemJson_(
    'system-status.json',
    payload,
    'Update ART SYSTEM runtime status'
  );
}

function writeSystemEventsToNexus_(payload) {
  return writeArtSystemJson_(
    'system-events.json',
    payload,
    'Batch ART SYSTEM operational events'
  );
}

function writeSystemHistoryToNexus_(payload) {
  return writeArtSystemJson_(
    'system-history.json',
    payload,
    'Update ART SYSTEM history'
  );
}

function writeSystemUsageToNexus_(payload) {
  return writeArtSystemJson_(
    'system-usage.json',
    payload,
    'Update ART SYSTEM usage'
  );
}

function writePublicAutomationStatus_(payload) {
  return writeArtSystemJson_(
    'automation-status.json',
    payload,
    'Update automation status'
  );
}

/**
 * One-time permission / path smoke test.
 * This does NOT overwrite production telemetry.
 */
function testNexusArtSystemTarget() {
  const path = NEXUS_ART_SYSTEM_TARGET.basePath + '/migration-test.json';
  const payload = {
    ok: true,
    project: '그림 자동화 관리자',
    target: 'NEXUS-SYSTEM',
    testedAt: new Date().toISOString()
  };
  return githubWriteJson_(
    NEXUS_ART_SYSTEM_TARGET,
    path,
    payload,
    'Test ART SYSTEM NEXUS write target'
  );
}
