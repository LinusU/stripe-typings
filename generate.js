const input = require('./input.json')

function titleCase (snake) {
  return snake.replace(/(^|_)([a-z])/g, (s) => s.replace('_', '').toUpperCase())
}

function isPrimitive (schema) {
  switch (schema.type) {
    case 'boolean':
    case 'number':
    case 'string':
    case 'integer':
      return true
  }

  return false
}

function primitiveType (schema) {
  switch (schema.type) {
    case 'boolean':
    case 'number':
    case 'string':
      return schema.type
    case 'integer':
      return 'number'
  }

  throw new Error(`primitiveType called on non-primitve schema`)
}

function isReference (schema) {
  return Boolean(schema['$ref'])
}

function referenceType (schema) {
  return titleCase(schema['$ref'].replace('#/components/schemas/', ''))
}

function isEnum (schema) {
  return Boolean(schema.enum)
}

function enumType (schema) {
  return schema.enum.map(v => JSON.stringify(v)).join(' | ')
}

function isAnyOf (schema) {
  return Boolean(schema.anyOf)
}

function anyOfType (schema, extra) {
  return schema.anyOf.map(a => generateInlineType(a, extra)).join(' | ')
}

function isArray (schema) {
  return (schema.type === 'array')
}

function arrayType (schema, extra) {
  return schema.items ? `(${generateInlineType(schema.items, extra)})[]` : 'any[]'
}

function objectType (schema, extra) {
  const keys = Object.keys(schema.properties)
  const properties = []

  for (const key of keys) {
    const propertySchema = schema.properties[key]
    const nullable = propertySchema.nullable || false
    const optional = !(schema.required || []).includes(key)

    properties.push(`${key}${optional ? '?' : ''}: ${generateInlineType(propertySchema, extra)}${nullable ? ' | null' : ''}`)
  }

  return `{ ${properties.join(', ')} }`
}

function generateInlineType (schema, extra) {
  if (isEnum(schema)) {
    return enumType(schema)
  } else if (isPrimitive(schema)) {
    return primitiveType(schema)
  } else if (isReference(schema)) {
    return referenceType(schema)
  } else if (isAnyOf(schema)) {
    return anyOfType(schema, extra)
  } else if (isArray(schema)) {
    return arrayType(schema, extra)
  } else if (schema.type === 'object' && !schema.properties) {
    return '{ [key: string]: string }'
  } else if (schema.type === 'object' && schema.title) {
    extra.push(generateType(schema.title, schema))
    return schema.title
  } else if (schema.type === 'object') {
    return objectType(schema)
  } else {
    throw new Error('Not implemented')
  }
}

function generateType (name, schema) {
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties)
    const properties = []
    const extra = []

    for (const key of keys) {
      const propertySchema = schema.properties[key]
      const nullable = propertySchema.nullable || false
      const optional = !(schema.required || []).includes(key)

      if (propertySchema.description) {
        properties.push('    /**')
        properties.push('     * ' + propertySchema.description)
        properties.push('     */')
      }

      properties.push(`    ${key}${optional ? '?' : ''}: ${generateInlineType(propertySchema, extra)}${nullable ? ' | null' : ''}`)
    }

    return `${extra.length ? extra.join('\n') + '\n' : ''}interface ${name} {\n${properties.join('\n')}\n}\n`
  } else if (schema.anyOf) {
    return `type ${name} = ${generateInlineType(schema)}\n`
  } else {
    console.error('Unknown schema type (not object nor anyOf)')
  }
}

for (const [id, schema] of Object.entries(input.components.schemas)) {
  if (id === 'error') continue
  console.log(generateType(titleCase(id), schema))
}
