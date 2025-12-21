# Content Security Policy (CSP) Configuration

## Overview

Content Security Policy helps prevent XSS attacks by controlling which resources can be loaded and executed. This document describes how to configure CSP for NICEBASE in production.

## Client-Side (Meta Tag)

A basic CSP meta tag has been added to `index.html`. However, for production deployments, server-side CSP headers are recommended as they are more flexible and secure.

## Server-Side Configuration

### Recommended CSP Policy

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval'; # unsafe-inline/eval needed for Vite HMR in dev, consider removing in production
style-src 'self' 'unsafe-inline';
img-src 'self' data: https: blob:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co https://api.openai.com;
frame-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

### Platform-Specific Examples

#### Apache (.htaccess)

```apache
<IfModule mod_headers.c>
  Header set Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.openai.com; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
</IfModule>
```

#### Nginx

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.openai.com; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;" always;
```

#### Vercel (vercel.json)

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.openai.com; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
        }
      ]
    }
  ]
}
```

#### Netlify (netlify.toml)

```toml
[[headers]]
  for = "/*"
  [headers.values]
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://api.openai.com; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
```

### Production Optimization

For production builds, consider:

1. **Remove `unsafe-eval`**: After testing, remove `unsafe-eval` from `script-src` if possible
2. **Remove `unsafe-inline`**: Use nonces or hashes for inline scripts/styles
3. **Strict connect-src**: Limit to only your Supabase project URL instead of wildcard

Example optimized production policy:

```
default-src 'self';
script-src 'self' 'nonce-{random-nonce}';
style-src 'self' 'nonce-{random-nonce}';
img-src 'self' data: https: blob:;
font-src 'self' data:;
connect-src 'self' https://your-project.supabase.co https://api.openai.com;
frame-src 'none';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

## Allowed Domains

- **Supabase**: `https://*.supabase.co` (or your specific project URL)
- **OpenAI**: `https://api.openai.com`

## Testing

After implementing CSP:

1. Test all app features to ensure nothing breaks
2. Check browser console for CSP violations
3. Use browser DevTools → Network tab → Response Headers to verify CSP header is present
4. Use online CSP validators:
   - https://csp-evaluator.withgoogle.com/
   - https://cspvalidator.org/

## Troubleshooting

### Common Issues

1. **Scripts not loading**: Add domain to `script-src`
2. **Styles not loading**: Add domain to `style-src`
3. **API calls failing**: Add domain to `connect-src`
4. **Images not loading**: Add domain to `img-src`

### Reporting Mode

For testing, use CSP in report-only mode:

```
Content-Security-Policy-Report-Only: ...
```

This will log violations without blocking them.

## References

- [MDN: Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [CSP Evaluator](https://csp-evaluator.withgoogle.com/)








