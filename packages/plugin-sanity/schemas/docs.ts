export default {
  name: "doc",
  title: "Documentation",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
      description: "The title of the documentation page (used as headline in structured data)",
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "slug",
      title: "Slug",
      type: "slug",
      options: {
        source: "title",
        maxLength: 96,
      },
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "content",
      title: "Content",
      type: "array",
      of: [
        { type: "block" },
        {
          type: "image",
          fields: [
            {
              name: "alt",
              title: "Alt Text",
              type: "string",
              description: "Describe the image for accessibility and SEO",
              validation: (Rule: any) => Rule.required(),
            },
          ],
        },
      ],
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "publishedAt",
      title: "Published At",
      type: "datetime",
      description: "Publication date (used as datePublished in structured data)",
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "modifiedAt",
      title: "Modified At",
      type: "datetime",
      description: "Last modified date (used as dateModified in structured data)",
    },
    {
      name: "seoDescription",
      title: "SEO Description",
      type: "string",
      description: "Description for SEO meta tags and structured data (max 160 characters)",
      validation: (Rule: any) => Rule.required().max(160),
    },
    {
      name: "excerpt",
      title: "Excerpt",
      type: "string",
      description: "A short summary for frontend previews, e.g., in docs lists (max 200 characters)",
      validation: (Rule: any) => Rule.required().max(200),
    },
    {
      name: "mainImage",
      title: "Main Image",
      type: "image",
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: "alt",
          title: "Alt Text",
          type: "string",
          description: "Describe the image for accessibility and SEO (used as image description in structured data)",
          validation: (Rule: any) => Rule.required(),
        },
      ],
      description: "Featured image for social media, previews, and structured data",
    },
    {
      name: "heroImage",
      title: "Hero Image",
      type: "image",
      options: {
        hotspot: true,
      },
      fields: [
        {
          name: "alt",
          title: "Alt Text",
          type: "string",
          description: "Describe the hero image for accessibility and SEO",
          validation: (Rule: any) => Rule.required(),
        },
      ],
      description: "Prominent image displayed at the top of the documentation page",
    },
    {
      name: "galleryImages",
      title: "Gallery Images",
      type: "array",
      of: [
        {
          type: "image",
          fields: [
            {
              name: "alt",
              title: "Alt Text",
              type: "string",
              description: "Describe the gallery image for accessibility and SEO",
              validation: (Rule: any) => Rule.required(),
            },
          ],
          options: {
            hotspot: true,
          },
        },
      ],
      description: "Additional images to display in a gallery section",
    },
    {
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
      description: "Keywords for SEO and structured data",
    },
    {
      name: "relatedContent",
      title: "Related Content",
      type: "array",
      of: [
        {
          type: "reference",
          to: [
            { type: "doc" },
            { type: "blogPost" },
            { type: "productPage" },
          ],
        },
      ],
      description: "Select up to 3 related docs, blog posts, or product pages to display at the bottom of the documentation page",
      validation: (Rule: any) => Rule.max(3),
    },
     {
      name: "sortOrder",
      title: "Sort Order",
      type: "number",
      description: "The order in which this document should appear (e.g., 1 for first, 2 for second, etc.)",
      validation: (Rule: any) => Rule.integer().min(1).optional(),
    },
    {
      name: "published",
      title: "Published",
      type: "boolean",
      initialValue: false,
    },
  ],
};