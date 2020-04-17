import React, { useState } from 'react'
import { create, act } from 'react-test-renderer'
import BugsnagPluginReact from '..'

class Event {
  static create () {
    return new Event()
  }

  addMetadata () {
    return this
  }
}

const bugsnag = {
  Event,
  _notify: jest.fn()
}

const plugin = new BugsnagPluginReact(React)
const ErrorBoundary = plugin.load(bugsnag)

beforeEach(() => {
  bugsnag._notify.mockReset()
})

test('formatComponentStack(str)', () => {
  const str = `
  in BadButton
  in ErrorBoundary`
  expect(BugsnagPluginReact.formatComponentStack(str))
    .toBe('in BadButton\nin ErrorBoundary')
})

const BadComponent = () => {
  throw Error('BadComponent')
}

// see https://github.com/DefinitelyTyped/DefinitelyTyped/issues/20544
const GoodComponent = (): JSX.Element => 'test' as unknown as JSX.Element

const FallbackComponent = ({ clearError }: { clearError: () => void }) => {
  return (
    <button onClick={() => clearError()}>clearError</button>
  )
}

const ComponentWithBadButton = () => {
  const [clicked, setClicked] = useState(false)

  if (clicked) {
    throw new Error('bad button')
  }
  return <button onClick={() => setClicked(true)}>click for error</button>
}

it('renders correctly', () => {
  const tree = create(<ErrorBoundary><GoodComponent /></ErrorBoundary>)
    .toJSON()
  expect(tree).toMatchSnapshot()
})

it('renders correctly on error', () => {
  const tree = create(<ErrorBoundary><BadComponent /></ErrorBoundary>)
    .toJSON()
  expect(tree).toBe(null)
})

it('calls notify on error', () => {
  create(<ErrorBoundary><BadComponent /></ErrorBoundary>)
    .toJSON()
  expect(bugsnag._notify).toHaveBeenCalledTimes(1)
})

it('does not render FallbackComponent when no error', () => {
  const FallbackComponent = jest.fn(() => 'fallback')
  const tree = create(<ErrorBoundary FallbackComponent={FallbackComponent}><GoodComponent /></ErrorBoundary>)
    .toJSON()
  expect(tree).toMatchSnapshot()
  expect(FallbackComponent).toHaveBeenCalledTimes(0)
})

it('renders FallbackComponent on error', () => {
  const FallbackComponent = jest.fn(() => 'fallback')
  const tree = create(<ErrorBoundary FallbackComponent={FallbackComponent}><BadComponent /></ErrorBoundary>)
    .toJSON()
  expect(tree).toMatchSnapshot()
})

it('passes the props to the FallbackComponent', () => {
  const FallbackComponent = jest.fn(() => 'fallback')
  create(<ErrorBoundary FallbackComponent={FallbackComponent}><BadComponent /></ErrorBoundary>)
  expect(FallbackComponent).toBeCalledWith({
    error: expect.any(Error),
    info: { componentStack: expect.any(String) },
    clearError: expect.any(Function)
  }, {})
})

it('resets the error boundary when the FallbackComponent calls the passed clearError prop', () => {
  const component = create(<ErrorBoundary FallbackComponent={FallbackComponent}><ComponentWithBadButton /></ErrorBoundary>)
  const instance = component.root

  // Trigger a render exception
  const badButton = instance.findByType(ComponentWithBadButton).findByType('button')
  act(() => {
    badButton.props.onClick()
  })

  // Click the button in the fallback, which calls clearError
  const button = instance.findByType(FallbackComponent).findByType('button')
  act(() => {
    button.props.onClick()
  })

  // expect to see ComponentWithBadButton again
  expect(component.toJSON()).toMatchSnapshot()
})

it('a bad FallbackComponent implementation does not trigger stack overflow', () => {
  const BadFallbackComponentImplementation = ({ clearError }: { clearError: () => void }) => {
    clearError()

    return <div>fallback</div>
  }

  expect(() => {
    create(<ErrorBoundary FallbackComponent={BadFallbackComponentImplementation}><BadComponent /></ErrorBoundary>)
  }).toThrow()
})

it('it passes the onError function to the Bugsnag notify call', () => {
  const onError = () => {}
  create(<ErrorBoundary onError={onError}><BadComponent /></ErrorBoundary>)
    .toJSON()
  expect(bugsnag._notify).toBeCalledWith(
    expect.any(Event),
    onError
  )
})
