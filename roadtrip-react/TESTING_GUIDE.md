# Testing Quick Reference Guide

## Running Tests

### Watch Mode (Development)
```bash
npm test
```
- Runs tests in watch mode
- Auto-reruns on file changes
- Interactive CLI for filtering tests

### Single Run (CI/Production)
```bash
npm run test:run
```
- Runs all tests once
- Exits after completion
- Suitable for CI/CD pipelines

### UI Mode (Visual Testing)
```bash
npm run test:ui
```
- Opens browser-based test UI
- Visual test exploration
- Interactive debugging
- Real-time test results

### Coverage Report
```bash
npm run test:coverage
```
- Generates coverage report
- Creates HTML report in `coverage/` directory
- Shows untested lines
- Provides coverage statistics

## Test File Locations

```
roadtrip-react/src/
??? test/
?   ??? setup.js                  # Global test configuration
?   ??? Button.test.jsx           # ? Button component tests (30/30)
?   ??? useTripRecorder.test.js   # ? Hook tests (30/38)
??? components/
    ??? [component files]          # Components to test
```

## Writing New Tests

### Component Test Template

```javascript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import YourComponent from '../components/YourComponent';

describe('YourComponent', () => {
  describe('Rendering', () => {
    it('renders correctly', () => {
      render(<YourComponent />);
      expect(screen.getByRole('...')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('handles user interactions', async () => {
      const user = userEvent.setup();
      render(<YourComponent />);
      
      await user.click(screen.getByRole('button'));
      // Add assertions
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<YourComponent />);
      const element = screen.getByRole('...');
      expect(element).toHaveAccessibleName();
    });
  });
});
```

### Hook Test Template

```javascript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useYourHook from '../hooks/useYourHook';

describe('useYourHook', () => {
  it('initializes with default values', () => {
    const { result } = renderHook(() => useYourHook());
    expect(result.current.value).toBe(defaultValue);
  });

  it('updates state correctly', () => {
    const { result } = renderHook(() => useYourHook());
    
    act(() => {
      result.current.updateValue(newValue);
    });
    
    expect(result.current.value).toBe(newValue);
  });
});
```

## Testing Utilities

### Rendering with Context

```javascript
import { AppProvider } from '../context/AppContext';

function renderWithProviders(ui, options) {
  const wrapper = ({ children }) => (
    <AppProvider>
      {children}
    </AppProvider>
  );
  
  return render(ui, { wrapper, ...options });
}

// Usage
renderWithProviders(<YourComponent />);
```

### Mocking Functions

```javascript
import { vi } from 'vitest';

// Mock a function
const mockFn = vi.fn();

// Mock with implementation
const mockFn = vi.fn(() => 'return value');

// Check if called
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
```

### User Events

```javascript
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();

// Click
await user.click(element);

// Type
await user.type(input, 'text');

// Keyboard
await user.keyboard('{Enter}');

// Hover
await user.hover(element);
```

### Async Testing

```javascript
import { waitFor } from '@testing-library/react';

// Wait for assertion
await waitFor(() => {
  expect(element).toBeInTheDocument();
});

// Wait with timeout
await waitFor(() => {
  expect(element).toBeVisible();
}, { timeout: 3000 });

// Find elements (automatically waits)
const element = await screen.findByRole('button');
```

## Common Assertions

### DOM Queries

```javascript
// By role (preferred)
screen.getByRole('button', { name: /submit/i });

// By text
screen.getByText(/hello world/i);

// By label
screen.getByLabelText('Email');

// By test ID
screen.getByTestId('custom-element');
```

### Matchers

```javascript
// Existence
expect(element).toBeInTheDocument();
expect(element).not.toBeInTheDocument();

// Visibility
expect(element).toBeVisible();
expect(element).not.toBeVisible();

// Enabled/Disabled
expect(button).toBeEnabled();
expect(button).toBeDisabled();

// Classes
expect(element).toHaveClass('active');

// Attributes
expect(element).toHaveAttribute('aria-label', 'Save');

// Text content
expect(element).toHaveTextContent('Hello');

// Focus
expect(element).toHaveFocus();
```

## Debugging Tests

### Print DOM

```javascript
import { screen } from '@testing-library/react';

// Print entire DOM
screen.debug();

// Print specific element
screen.debug(element);
```

### Verbose Output

```bash
npm test -- --reporter=verbose
```

### Filter Tests

```bash
# Run specific file
npm test Button.test.jsx

# Run tests matching pattern
npm test -- --grep "Rendering"

# Run only tests with .only
it.only('runs this test', () => {
  // ...
});
```

### Watch Specific Files

```bash
# Watch specific test file
npm test -- Button.test.jsx --watch
```

## Mocks Available (from setup.js)

### Geolocation

```javascript
navigator.geolocation.getCurrentPosition(success, error);
navigator.geolocation.watchPosition(success, error, options);
navigator.geolocation.clearWatch(watchId);
```

### Permissions

```javascript
const result = await navigator.permissions.query({ name: 'geolocation' });
// result.state === 'granted' | 'denied' | 'prompt'
```

### Wake Lock

```javascript
const wakeLock = await navigator.wakeLock.request('screen');
await wakeLock.release();
```

### localStorage

```javascript
localStorage.setItem('key', 'value');
const value = localStorage.getItem('key');
localStorage.removeItem('key');
localStorage.clear();
```

### Media Devices

```javascript
const stream = await navigator.mediaDevices.getUserMedia({ video: true });
const devices = await navigator.mediaDevices.enumerateDevices();
```

## Test Coverage Targets

| Component | Target | Status |
|-----------|--------|--------|
| UI Components | 90% | ? |
| Hooks | 90% | ? |
| Context | 80% | ? |
| Utilities | 85% | ? |
| Overall | 80% | ? |

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what users see and do
   - Avoid testing internal state
   - Test from user perspective

2. **Arrange-Act-Assert Pattern**
   ```javascript
   // Arrange
   const { result } = renderHook(() => useHook());
   
   // Act
   act(() => {
     result.current.doSomething();
   });
   
   // Assert
   expect(result.current.value).toBe(expected);
   ```

3. **Use Descriptive Test Names**
   ```javascript
   // Good
   it('calls onSave with form data when submit button is clicked', () => {});
   
   // Bad
   it('works', () => {});
   ```

4. **Test Edge Cases**
   - Empty states
   - Error conditions
   - Boundary values
   - Disabled states

5. **Keep Tests Independent**
   - Each test should run in isolation
   - Use `beforeEach` for setup
   - Clean up in `afterEach`

6. **Accessibility Testing**
   - Test keyboard navigation
   - Verify ARIA attributes
   - Check focus management
   - Test screen reader announcements

## Common Issues & Solutions

### Issue: "Element not found"
**Solution**: Use `findBy*` queries that wait for elements
```javascript
// Instead of getBy
const element = await screen.findByRole('button');
```

### Issue: "Not wrapped in act()"
**Solution**: Use `act()` for state updates
```javascript
await act(async () => {
  result.current.updateState();
});
```

### Issue: "Timeout waiting for element"
**Solution**: Increase timeout or fix async logic
```javascript
await waitFor(() => {
  expect(element).toBeInTheDocument();
}, { timeout: 5000 });
```

### Issue: "Cannot read property of undefined"
**Solution**: Check mocks are set up correctly
```javascript
// Verify mock setup in beforeEach
beforeEach(() => {
  vi.clearAllMocks();
  // Re-initialize mocks if needed
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:run
      - run: npm run test:coverage
```

## Next Steps

1. ? Fix async timing in hook tests
2. ? Add remaining component tests
3. ? Create integration tests
4. ? Set up E2E testing
5. ? Configure coverage thresholds
6. ? Add mobile device testing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Jest DOM Matchers](https://github.com/testing-library/jest-dom)
- [User Event Library](https://testing-library.com/docs/user-event/intro)