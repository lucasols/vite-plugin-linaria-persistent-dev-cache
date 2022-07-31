import { useState } from 'react'
import './App.css'
import { css } from '@linaria/core'
import { styled } from '@linaria/react'

const test = css`
  color: yellow;
`

const StyledTest = styled.div`
  color: blue;
`

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="App">
      <h1 className={test} data-testid="title">
        Vite + React 5
      </h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>

        <button
          onClick={() => {
            console.log('hello23')
          }}
        >
          Debug
        </button>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
        <StyledTest data-testid="styled-component">Test</StyledTest>
      </p>
    </div>
  )
}

export default App
