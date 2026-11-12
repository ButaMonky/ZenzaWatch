"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.siteRules = siteRules;
exports.matchesSiteRule = matchesSiteRule;
// URL rules share @match-style boundaries; no requests and no arbitrary regex execution.
function siteRules(value) {
    if (typeof value !== 'string')
        return [];
    return value.split(/\r?\n/).flatMap(line => {
        const clean = line.trim().replace(/^\/\/\s*(?=@)/, '').replace(/^@(match|include|exclude)\s+/, '');
        if (!clean || clean.startsWith('//') || clean.startsWith('#'))
            return [];
        return clean.includes('://') || clean === '*' ? [clean] : clean.split(/[\s,]+/).filter(Boolean);
    });
}
function glob(pattern, value) {
    // Linear-space wildcard matcher; '*' is the only metacharacter.
    const parts = pattern.split('*');
    if (parts.length === 1)
        return value === pattern;
    if (!value.startsWith(parts[0]))
        return false;
    let pos = parts[0].length;
    for (const part of parts.slice(1, -1)) {
        const at = value.indexOf(part, pos);
        if (at < 0)
            return false;
        pos = at + part.length;
    }
    const tail = parts[parts.length - 1];
    return value.length - pos >= tail.length && value.endsWith(tail);
}
function matchesSiteRule(rule, address) {
    let url;
    try {
        url = new URL(address.includes('://') ? address : 'https://' + address + '/');
    }
    catch {
        return false;
    }
    if (!['https:', 'http:'].includes(url.protocol))
        return false;
    if (rule === '*')
        return true;
    if (!rule.includes('://')) {
        const domain = rule.toLowerCase().replace(/^\*\./, '');
        if (rule.includes('*') && !rule.startsWith('*.'))
            return glob(rule, url.href.split('#')[0]);
        if (!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/.test(domain))
            return false;
        return url.hostname === domain || url.hostname.endsWith('.' + domain);
    }
    const match = /^(https?|http\*|\*):\/\/([^/]+)(\/[^#]*)?$/.exec(rule);
    if (!match)
        return false;
    const [, scheme, authority] = match, path = match[3] || (authority.includes('*') ? '/*' : '/');
    if (scheme !== '*' && scheme !== 'http*' && url.protocol !== scheme + ':')
        return false;
    const hostPort = /^([^:@]+)(?::(\d+|\*))?$/.exec(authority);
    if (!hostPort)
        return false;
    const host = hostPort[1].toLowerCase(), port = hostPort[2];
    if (port && port !== '*' && (url.port || (url.protocol === 'https:' ? '443' : '80')) !== port)
        return false;
    const matchesHost = host === '*' || (host.startsWith('*.') ? (url.hostname === host.slice(2) || url.hostname.endsWith('.' + host.slice(2))) : glob(host, url.hostname));
    return matchesHost && glob(path, url.pathname + url.search);
}
