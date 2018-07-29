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

function generateType (name, schema) {
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties)
    const properties = []
    const extra = []

    for (const key of keys) {
      const propertySchema = schema.properties[key]
      const nullable = propertySchema.nullable || false
      const optional = !(schema.required || []).includes(key)

      if (isPrimitive(propertySchema)) {
        properties.push(`    ${key}${optional ? '?' : ''}: ${primitiveType(propertySchema)}${nullable ? ' | null' : ''}`)
      } else if (isReference(propertySchema)) {
        properties.push(`    ${key}${optional ? '?' : ''}: ${referenceType(propertySchema)}${nullable ? ' | null' : ''}`)
      } else if (propertySchema.anyOf) {
        properties.push(`    ${key}${optional ? '?' : ''}: ${generateInlineType(propertySchema)}${nullable ? ' | null' : ''}`)
      } else if (propertySchema.type === 'array') {
        const itemSchema = propertySchema.items

        if (!itemSchema) {
          properties.push(`    ${key}${optional ? '?' : ''}: any[]${nullable ? ' | null' : ''}`)
        } else if (isPrimitive(itemSchema)) {
          properties.push(`    ${key}${optional ? '?' : ''}: ${primitiveType(itemSchema)}[]${nullable ? ' | null' : ''}`)
        } else if (isReference(itemSchema)) {
          properties.push(`    ${key}${optional ? '?' : ''}: ${referenceType(itemSchema)}[]${nullable ? ' | null' : ''}`)
        } else {
          const itemName = `${name}_${titleCase(key)}`
          extra.push(generateType(itemName, itemSchema))
          properties.push(`    ${key}${optional ? '?' : ''}: ${itemName}[]${nullable ? ' | null' : ''}`)
        }
      } else if (propertySchema.type === 'object' && !propertySchema.properties) {
        properties.push(`    ${key}${optional ? '?' : ''}: { [key: string]: string }${nullable ? ' | null' : ''}`)
      } else if (propertySchema.type === 'object') {
        const propertyName = `${name}_${titleCase(key)}`
        extra.push(generateType(propertyName, propertySchema))
        properties.push(`    ${key}${optional ? '?' : ''}: ${propertyName}${nullable ? ' | null' : ''}`)
      } else {
        console.error(`Unknown type:`, propertySchema)
      }
    }

    return `${extra.length ? extra.join('\n') + '\n' : ''}interface ${name} {\n${properties.join('\n')}\n}\n`
  } else if (schema.anyOf) {
    const types = []

    for (const a of schema.anyOf) {
      if (isPrimitive(a)) {
        types.push(primitiveType(a))
      } else if (isReference(a)) {
        types.push(referenceType(a))
      } else {
        console.error('anyOf with non-primitive & non-reference child')
      }
    }

    return `type ${name} = ${types.join(' | ')}\n`
  } else {
    console.error('Unknown schema type (not object nor anyOf)')
  }
}

for (const [id, schema] of Object.entries(input.components.schemas)) {
  if (id === 'error') continue
  console.log(generateType(titleCase(id), schema))
}
