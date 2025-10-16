export default {
    name: "landingPage",
    title: "Landing Page",
    type: "document",
    fields: [
      {
        name: "title",
        title: "Title",
        type: "string",
        description: "The title of the landing page (for internal reference).",
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
      // Hero Section
      {
        name: "heroSection",
        title: "Hero Section",
        type: "object",
        fields: [
          {
            name: "title",
            title: "Title",
            type: "string",
            validation: (Rule: any) => Rule.required(),
          },
          {
            name: "subtitle",
            title: "Subtitle",
            type: "text",
            validation: (Rule: any) => Rule.required(),
          },
          {
            name: "primaryCtaText",
            title: "Primary CTA Text",
            type: "string",
            validation: (Rule: any) => Rule.required(),
          },
          {
            name: "secondaryCtaText",
            title: "Secondary CTA Text",
            type: "string",
          },
          {
            name: "trustSignal",
            title: "Trust Signal",
            type: "string",
            description: "E.g., 'Trusted by 10,000+ users'",
          },
          {
            name: "backgroundImage",
            title: "Background Image",
            type: "image",
            options: {
              hotspot: true,
            },
          },
          {
            name: "mascotModel",
            title: "Mascot 3D Model",
            type: "file",
            accept: ".glb,.gltf",
            description: "Upload a GLTF/GLB model for the hero section mascot",
          },
        ],
      },
      // Features Section
      {
        name: "featuresSection",
        title: "Features Section",
        type: "object",
        fields: [
          {
            name: "heading",
            title: "Heading",
            type: "string",
            validation: (Rule: any) => Rule.required(),
          },
          {
            name: "features",
            title: "Features",
            type: "array",
            of: [
              {
                type: "object",
                fields: [
                  {
                    name: "title",
                    title: "Title",
                    type: "string",
                    validation: (Rule: any) => Rule.required(),
                  },
                  {
                    name: "description",
                    title: "Description",
                    type: "text",
                    validation: (Rule: any) => Rule.required(),
                  },
                  {
                    name: "icon",
                    title: "Icon",
                    type: "image",
                    options: {
                      hotspot: true,
                    },
                  },
                ],
              },
            ],
            validation: (Rule: any) => Rule.required().min(1),
          },
          {
            name: "ctaText",
            title: "CTA Text",
            type: "string",
            validation: (Rule: any) => Rule.required(),
          },
        ],
      },
      // Benefits Section
      {
        name: "benefitsSection",
        title: "Benefits Section",
        type: "object",
        fields: [
          {
            name: "heading",
            title: "Heading",
            type: "string",
            validation: (Rule: any) => Rule.required(),
          },
          {
            name: "description",
            title: "Description",
            type: "text",
            validation: (Rule: any) => Rule.required(),
          },
          {
            name: "benefitsList",
            title: "Benefits List",
            type: "array",
            of: [{ type: "string" }],
            validation: (Rule: any) => Rule.required().min(1),
          },
          {
            name: "image",
            title: "Image",
            type: "image",
            options: {
              hotspot: true,
            },
          },
        ],
      },
      // Testimonials Section
      {
        name: "testimonialsSection",
        title: "Testimonials Section",
        type: "object",
        fields: [
          {
            name: "heading",
            title: "Heading",
            type: "string",
            validation: (Rule: any) => Rule.required(),
          },
          {
            name: "testimonials",
            title: "Testimonials",
            type: "array",
            of: [
              {
                type: "object",
                fields: [
                  {
                    name: "quote",
                    title: "Quote",
                    type: "text",
                    validation: (Rule: any) => Rule.required(),
                  },
                  {
                    name: "author",
                    title: "Author",
                    type: "string",
                    validation: (Rule: any) => Rule.required(),
                  },
                  {
                    name: "role",
                    title: "Role",
                    type: "string",
                    validation: (Rule: any) => Rule.required(),
                  },
                  {
                  name: "image",
                  title: "Author Image",
                  type: "image",
                  options: {
                    hotspot: true,
                  },
                },
                ],
              },
            ],
            validation: (Rule: any) => Rule.required().min(1),
          },
          {
            name: "trustSignal",
            title: "Trust Signal",
            type: "string",
            description: "E.g., 'Join 10,000+ happy users'",
            validation: (Rule: any) => Rule.required(),
          },
          {
          name: "sectionImage",
          title: "Section Image",
          type: "image",
          options: {
            hotspot: true,
          },
          description: "Image to display in the testimonials section",
        },
        ],
      },
      // CTA Section
      {
        name: "ctaSection",
        title: "CTA Section",
        type: "object",
        fields: [
          {
            name: "heading",
            title: "Heading",
            type: "string",
            validation: (Rule: any) => Rule.required(),
          },
          {
            name: "description",
            title: "Description",
            type: "text",
            validation: (Rule: any) => Rule.required(),
          },
          {
            name: "ctaText",
            title: "CTA Text",
            type: "string",
            validation: (Rule: any) => Rule.required(),
          },
           {
      name: "ctaUrl",
      title: "CTA URL",
      type: "url",
      validation: (Rule) =>
        Rule.uri({
          allowRelative: true, // Allow relative URLs like /blog/how-it-works
          scheme: ["http", "https"], // Restrict absolute URLs to http/https
        }),
      description: "Enter a relative URL (e.g., /blog/how-it-works) or absolute URL for the CTA button",
    },
        ],
      },
      // Footer Section
      {
        name: "footerSection",
        title: "Footer Section",
        type: "object",
        fields: [
          {
            name: "tagline",
            title: "Tagline",
            type: "string",
          },
          {
            name: "companyLinks",
            title: "Company Links",
            type: "array",
            of: [
              {
                type: "object",
                fields: [
                  {
                    name: "label",
                    title: "Label",
                    type: "string",
                  },
                  {
                    name: "url",
                    title: "URL",
                    type: "url",
                    validation: (Rule) =>
                      Rule.uri({
                        allowRelative: true, // Allow relative URLs like /about
                        scheme: ["http", "https"], // Optional: Restrict absolute URLs to http/https
                      }),
                  },
                ],
              },
            ],
            validation: (Rule) => Rule.unique(), // Optional: Ensure unique links
          },
          {
            name: "productLinks",
            title: "Product Links",
            type: "array",
            of: [
              {
                type: "object",
                fields: [
                  {
                    name: "label",
                    title: "Label",
                    type: "string",
                  },
                  {
                    name: "url",
                    title: "URL",
                    type: "url",
                    validation: (Rule) =>
                      Rule.uri({
                        allowRelative: true,
                        scheme: ["http", "https"],
                      }),
                  },
                ],
              },
            ],
            validation: (Rule) => Rule.unique(),
          },
          {
            name: "legalLinks",
            title: "Legal Links",
            type: "array",
            of: [
              {
                type: "object",
                fields: [
                  {
                    name: "label",
                    title: "Label",
                    type: "string",
                  },
                  {
                    name: "url",
                    title: "URL",
                    type: "url",
                    validation: (Rule) =>
                      Rule.uri({
                        allowRelative: true,
                        scheme: ["http", "https"],
                      }),
                  },
                ],
              },
            ],
            validation: (Rule) => Rule.unique(),
          },
          {
      name: "socialLinks",
      title: "Social Links",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            {
              name: "platform",
              title: "Platform",
              type: "string",
              options: {
                list: [
                  { title: "Twitter", value: "twitter" },
                  { title: "Facebook", value: "facebook" },
                  { title: "WhatsApp", value: "whatsapp" },
                  { title: "GitHub", value: "github" },
                  { title: "LinkedIn", value: "linkedin" },
                ],
              },
              validation: (Rule) => Rule.required(),
            },
            {
              name: "url",
              title: "URL",
              type: "url",
              validation: (Rule) =>
                Rule.required().uri({
                  scheme: ["http", "https"],
                }),
            },
          ],
        },
      ],
      validation: (Rule) => Rule.unique(),
    },
        ],
      },
      // Sub-Footer Section
      {
        name: "subFooterSection",
        title: "Sub-Footer Section",
        type: "object",
        fields: [
          {
            name: "ctaText",
            title: "CTA Text",
            type: "string",
            validation: (Rule) => Rule.required(),
          },
          {
            name: "ctaUrl",
            title: "CTA URL",
            type: "url",
            validation: (Rule) =>
              Rule.required().uri({
                allowRelative: true, // Allow relative URLs like /demo
                scheme: ["http", "https"], // Optional: Restrict absolute URLs to http/https
              }),
            description: "Enter a relative URL (e.g., /demo) or absolute URL (e.g., https://example.com)",
          },
          {
            name: "copyright",
            title: "Copyright Text",
            type: "string",
            validation: (Rule) => Rule.required(),
          },
        ],
      },
    ],
  };