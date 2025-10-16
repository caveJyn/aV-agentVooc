export default {
  name: "companyPage",
  title: "Company Page",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Title",
      type: "string",
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
      of: [{ type: "block" }, { type: "image" }],
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "lastUpdated",
      title: "Last Updated",
      type: "datetime",
      validation: (Rule: any) => Rule.required(),
    },
    {
      name: "mainImage",
      title: "Main Image",
      type: "image",
      options: {
        hotspot: true,
      },
      description: "Featured image for social media and previews",
      fields: [
        {
          name: "alt",
          title: "Alternative Text",
          type: "string",
          description: "Alt text for accessibility and SEO",
          validation: (Rule: any) => Rule.required().min(5).max(200),
        },
      ],
    },
    {
      name: "published",
      title: "Published",
      type: "boolean",
      description: "Set to true to make this page publicly visible",
      initialValue: false,
      validation: (Rule: any) => Rule.required(),
    },
  ],
};