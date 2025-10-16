// /packages/plugin-sanity/schemas/table.ts
export default {
  name: 'table',
  title: 'Table',
  type: 'object',
  fields: [
    {
      name: 'caption',
      title: 'Table Caption',
      type: 'string',
      description: 'Optional caption for the table, displayed below it for accessibility and context.',
    },
    {
      name: 'columns',
      title: 'Column Headers',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'column',
          fields: [
            {
              name: 'content',
              title: 'Header Content',
              type: 'array',
              of: [{ type: 'block' }],
              validation: (Rule: any) => Rule.required(),
            },
            {
              name: 'align',
              title: 'Alignment',
              type: 'string',
              options: {
                list: [
                  { title: 'Left', value: 'left' },
                  { title: 'Center', value: 'center' },
                  { title: 'Right', value: 'right' },
                ],
                layout: 'radio',
                direction: 'horizontal',
              },
              initialValue: 'left',
            },
            {
              name: 'width',
              title: 'Column Width (Optional)',
              type: 'string',
              description: 'Optional width (e.g., "20%", "100px"). Leave blank for auto width.',
            },
          ],
          preview: {
            select: {
              content: 'content',
              align: 'align',
            },
            prepare(value: Record<string, any>) {
              const { content, align } = value
              const text = content
                ?.map((block: any) =>
                  block.children?.map((child: any) => child.text || '').join('')
                )
                .join(' ')
              return {
                title: text || 'Empty Header',
                subtitle: `Align: ${align || 'left'}`,
              }
            },
          },
        },
      ],
      validation: (Rule: any) => Rule.required().min(1).max(12),
      description: 'Define the column headers for the table.',
    },
    {
      name: 'rows',
      title: 'Rows',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'row',
          fields: [
            {
              name: 'cells',
              title: 'Cells',
              type: 'array',
              of: [
                {
                  type: 'object',
                  name: 'cell',
                  fields: [
                    {
                      name: 'content',
                      title: 'Cell Content',
                      type: 'array',
                      of: [
                        {
                          type: 'block',
                          styles: [
                            { title: 'Normal', value: 'normal' },
                            { title: 'H1', value: 'h1' },
                            { title: 'H2', value: 'h2' },
                            { title: 'H3', value: 'h3' },
                            { title: 'H4', value: 'h4' },
                            { title: 'H5', value: 'h5' },
                            { title: 'H6', value: 'h6' },
                            { title: 'Quote', value: 'blockquote' },
                          ],
                          marks: {
                            decorators: [
                              { title: 'Bold', value: 'strong' },
                              { title: 'Italic', value: 'em' },
                              { title: 'Underline', value: 'underline' },
                              { title: 'Code', value: 'code' },
                            ],
                            annotations: [
                              {
                                name: 'link',
                                type: 'object',
                                title: 'Link',
                                fields: [
                                  {
                                    name: 'href',
                                    type: 'url',
                                    title: 'URL',
                                    validation: (Rule: any) =>
                                      Rule.uri({
                                        allowRelative: true,
                                        scheme: ['http', 'https', 'mailto', 'tel'],
                                      }).required(),
                                  },
                                  {
                                    name: 'openInNewTab',
                                    type: 'boolean',
                                    title: 'Open in new tab',
                                    initialValue: true,
                                  },
                                ],
                              },
                            ],
                          },
                          lists: [],
                        },
                      ],
                      validation: (Rule: any) => Rule.required(),
                    },
                    {
                      name: 'colspan',
                      title: 'Column Span',
                      type: 'number',
                      description: 'Number of columns this cell spans (1 or more).',
                      validation: (Rule: any) => Rule.min(1).integer().positive(),
                      initialValue: 1,
                    },
                    {
                      name: 'rowspan',
                      title: 'Row Span',
                      type: 'number',
                      description: 'Number of rows this cell spans (1 or more).',
                      validation: (Rule: any) => Rule.min(1).integer().positive(),
                      initialValue: 1,
                    },
                    {
                      name: 'align',
                      title: 'Alignment',
                      type: 'string',
                      options: {
                        list: [
                          { title: 'Left', value: 'left' },
                          { title: 'Center', value: 'center' },
                          { title: 'Right', value: 'right' },
                        ],
                        layout: 'radio',
                        direction: 'horizontal',
                      },
                      initialValue: 'left',
                    },
                  ],
                  preview: {
                    select: {
                      content: 'content',
                      colspan: 'colspan',
                      rowspan: 'rowspan',
                      align: 'align',
                    },
                    prepare(value: Record<string, any>) {
                      const { content, colspan, rowspan, align } = value
                      const text = content
                        ?.map((block: any) =>
                          block.children?.map((child: any) => child.text || '').join('')
                        )
                        .join(' ')
                      return {
                        title: text || 'Empty Cell',
                        subtitle: `Colspan: ${colspan}, Rowspan: ${rowspan}, Align: ${align}`,
                      }
                    },
                  },
                },
              ],
              validation: (Rule: any) => [
                Rule.required().min(1),
                Rule.custom((cells: any[], context: any) => {
                  const table = context.document || context.parent
                  const columnCount = table?.columns?.length || 0
                  if (columnCount === 0) return true
                  const totalColspan = cells.reduce((sum, cell) => sum + (cell.colspan || 1), 0)
                  return totalColspan === columnCount
                    ? true
                    : `Each row must have cells with a total colspan of ${columnCount} to match the number of columns.`
                }),
              ],
            },
          ],
          preview: {
            select: {
              cells: 'cells',
            },
            prepare(value: Record<string, any>) {
              const { cells } = value
              const text = cells
                ?.map((cell: any) =>
                  cell.content
                    ?.map((block: any) =>
                      block.children?.map((child: any) => child.text || '').join('')
                    )
                    .join('')
                )
                .join(' | ')
              return {
                title: text || 'Empty Row',
              }
            },
          },
        },
      ],
      validation: (Rule: any) => Rule.required().min(1),
    },
  ],
  validation: (Rule: any) =>
    Rule.custom((table: any) => {
      if (!table?.columns?.length || !table?.rows?.length) return true
      const columnCount = table.columns.length
      const invalidRows = table.rows.filter((row: any) => {
        const totalColspan = row.cells.reduce((sum: number, cell: any) => sum + (cell.colspan || 1), 0)
        return totalColspan !== columnCount
      })
      return invalidRows.length === 0
        ? true
        : `Some rows have a total colspan that does not match the ${columnCount} columns.`
    }),
  preview: {
    select: {
      rows: 'rows',
      columns: 'columns',
      caption: 'caption',
    },
    prepare(value: Record<string, any>) {
      const { rows, columns, caption } = value
      const title = `Table: ${columns?.length || 0} cols, ${rows?.length || 0} rows`
      return {
        title,
        subtitle: caption || 'No caption',
      }
    },
  },
}
