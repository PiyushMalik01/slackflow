# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - link "SlackFlow logo SlackFlow" [ref=e5] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]:
          - img "SlackFlow logo" [ref=e7]
          - generic [ref=e8]: SlackFlow
      - heading "Welcome back" [level=1] [ref=e9]
      - paragraph [ref=e10]: Sign in to your account
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Email
        - textbox "Email" [ref=e15]:
          - /placeholder: you@example.com
          - text: drishti@gmail.com
      - generic [ref=e16]:
        - generic [ref=e17]: Password
        - textbox "Password" [ref=e18]:
          - /placeholder: ••••••••
          - text: drishti@gmail.com
      - button "Sign in" [disabled] [ref=e19]:
        - img [ref=e20]
        - text: Sign in
    - paragraph [ref=e22]:
      - text: Don't have an account?
      - link "Create one" [ref=e23] [cursor=pointer]:
        - /url: /signup
  - button "Open Next.js Dev Tools" [ref=e29] [cursor=pointer]:
    - img [ref=e30]
  - alert [ref=e33]
```