# Contributing Guidelines

## Proprietary Software Notice

This is proprietary software developed exclusively for MDLBEAST Entertainment Company by Mahmoud Fouad. This codebase is protected by copyright law and international intellectual property treaties.

## Contribution Policy

**External contributions are not accepted** unless explicitly authorized through written agreement with the copyright holder.

### Restrictions

1. No external pull requests will be accepted
2. Code access is limited to authorized personnel only
3. All modifications require written permission
4. Non-disclosure agreements (NDA) are mandatory for any contributor
5. All contributions become property of the copyright holder

## For Authorized Contributors

If you have received explicit written authorization to contribute to this project:

### Prerequisites

1. Sign the Contributor License Agreement (CLA)
2. Execute a Non-Disclosure Agreement (NDA)
3. Receive access credentials from the project maintainer
4. Review and understand the codebase architecture

### Development Environment Setup

Follow the installation instructions in [README.md](./README.md) to set up your local development environment.

### Coding Standards

**General Guidelines**
- Write clean, maintainable, and well-documented code
- Follow existing architectural patterns and conventions
- Maintain type safety using TypeScript
- Ensure backward compatibility unless explicitly approved
- Write comprehensive tests for new features

**Code Style**
- Use TypeScript for all source files
- Follow existing naming conventions
- Maintain consistent indentation and formatting
- Include JSDoc comments for functions and classes
- Keep functions focused and single-purpose

**Security Requirements**
- Never commit sensitive credentials or API keys
- Follow secure coding practices (OWASP guidelines)
- Validate and sanitize all user inputs
- Use parameterized queries for database operations
- Implement proper authentication and authorization checks

### Development Workflow

1. **Create Feature Branch**
```bash
git checkout -b feature/description
```

2. **Implement Changes**
- Write code following the established standards
- Add appropriate tests
- Update documentation as needed

3. **Test Thoroughly**
```bash
npm run test
npm run build
```

4. **Commit Changes**
```bash
git add .
git commit -m "type(scope): description"
```

5. **Submit for Review**
- Push branch to remote repository
- Request code review from maintainer
- Address feedback and make necessary revisions

### Commit Message Format

Use the following format for commit messages:

```
type(scope): subject

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, whitespace)
- `refactor`: Code refactoring without functionality changes
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Example:**
```
feat(permissions): add custom permission override system

Implemented user-level permission overrides that take precedence
over default role permissions. Includes UI for permission management.

Closes #123
```

### Testing Requirements

- Write unit tests for business logic
- Include integration tests for API endpoints
- Ensure all tests pass before submitting
- Maintain or improve code coverage
- Test across supported browsers and devices

### Documentation

- Update README.md for user-facing changes
- Document API changes in appropriate files
- Include inline comments for complex logic
- Update CHANGELOG.md for version releases

## Code Review Process

All code changes undergo mandatory review before merging:

1. Code review by project maintainer
2. Automated testing and build verification
3. Security and compliance checks
4. Performance impact assessment
5. Documentation review

## Branching Strategy

- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Feature development branches
- `fix/*`: Bug fix branches
- `hotfix/*`: Emergency production fixes

## Intellectual Property

**All contributions are considered work-for-hire and become the exclusive property of Mahmoud Fouad upon submission.**

By contributing to this project, you:
- Transfer all intellectual property rights to the copyright holder
- Waive any claims to authorship or ownership
- Agree to maintain confidentiality indefinitely
- Acknowledge the proprietary nature of the software

## Legal Compliance

Contributors must:
- Comply with all applicable laws and regulations
- Not use or disclose proprietary information outside authorized scope
- Report any security vulnerabilities immediately
- Maintain confidentiality even after termination of involvement

## Contact & Authorization

For contribution authorization requests or legal inquiries:

**Mahmoud Fouad**  
Email: mahmoud.a.fouad2@gmail.com  
Phone: +966 530 047 640 | +20 111 658 8189

---

**IMPORTANT:** Unauthorized access, use, modification, or distribution of this codebase is strictly prohibited and may result in civil and criminal legal action.

**Copyright © 2024-2026 Mahmoud Fouad. All Rights Reserved.**
