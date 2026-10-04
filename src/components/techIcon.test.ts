import { describe, expect, it } from 'vitest'
import { techIcon } from './TechIcon'

describe('tech icons', () => {
  it('matches names, aliases and slugs', () => {
    expect(techIcon('Python')?.slug).toBe('python')
    expect(techIcon('C++')?.slug).toBe('cplusplus')
    expect(techIcon('scikit-learn')?.slug).toBe('scikitlearn')
    expect(techIcon('PySpark')?.slug).toBe('apachespark')
    expect(techIcon('AWS')?.slug).toBe('amazonwebservices')
    expect(techIcon('Node.js')?.slug).toBe('nodedotjs')
  })

  it('returns nothing for unknown skills', () => {
    expect(techIcon('prompt engineering')).toBeNull()
  })
})
