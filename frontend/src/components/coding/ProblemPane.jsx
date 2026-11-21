// The left side of the coding round: the problem, its examples, and the tests you can see.
export default function ProblemPane({ problem }) {
  const visible = problem.tests.filter((test) => !test.hidden)
  const hidden = problem.tests.length - visible.length

  return (
    <section className="code-problem">
      <div className="code-problem-head">
        <h2>{problem.title}</h2>
        <div className="code-tags">
          <span className={`code-tag ${problem.difficulty}`}>{problem.difficulty}</span>
          <span className="code-tag">{problem.topic}</span>
        </div>
      </div>

      <p className="code-statement">{problem.statement}</p>

      {problem.examples.map((example, i) => (
        <div key={i} className="code-example">
          <div className="code-example-title">Example {i + 1}</div>
          <code>Input: {example.input}</code>
          <code>Output: {example.output}</code>
        </div>
      ))}

      <div className="code-example-title">Your function</div>
      <code className="code-signature">{problem.starter.split('\n')[0]}</code>

      <p className="muted small code-test-note">
        {visible.length} tests run when you press Run. {hidden} hidden tests (edge cases and a big input with a time
        limit) run when you submit.
      </p>
    </section>
  )
}
