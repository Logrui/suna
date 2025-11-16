import { FlickeringGrid } from '@/components/ui/flickering-grid';
import { config } from '@/lib/config';

interface UpgradePlan {
  /** @deprecated */
  hours: string;
  price: string;
  tierKey: string;  // Backend tier key
}

export interface PricingTier {
  name: string;
  price: string;
  yearlyPrice?: string;
  description: string;
  buttonText: string;
  buttonColor: string;
  isPopular: boolean;
  /** @deprecated */
  hours: string;
  features: string[];
  tierKey: string;  // Backend tier key (e.g., 'tier_2_20', 'free')
  upgradePlans: UpgradePlan[];
  hidden?: boolean;
  billingPeriod?: 'monthly' | 'yearly';
  originalYearlyPrice?: string;
  discountPercentage?: number;
  stripePriceId?: string;
  yearlyStripePriceId?: string;
  monthlyCommitmentStripePriceId?: string;
}

export const siteConfig = {
  name: 'Kortix',
  description: 'The Generalist AI Worker that can act on your behalf.',
  cta: 'Start Free',
  url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  keywords: ['AI Worker', 'Generalist AI', 'Open Source AI', 'Autonomous Agent'],
  links: {
    email: 'support@kortix.com',
    twitter: 'https://x.com/kortix',
    // discord: 'https://discord.gg/kortixai',
    github: 'https://github.com/Kortix-ai/Suna',
    instagram: 'https://instagram.com/kortixai',
  },
  nav: {
    links: [
      { id: 1, name: 'Home', href: '#hero' },
      { id: 2, name: 'Process', href: '#process' },
      // { id: 3, name: 'Use Cases', href: '#use-cases' },
      { id: 4, name: 'Open Source', href: '#open-source' },
      { id: 5, name: 'Pricing', href: '#pricing' },
      { id: 6, name: 'Enterprise', href: '/enterprise' },
    ],
  },
  hero: {
    badgeIcon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-muted-foreground"
      >
        <path
          d="M7.62758 1.09876C7.74088 1.03404 7.8691 1 7.99958 1C8.13006 1 8.25828 1.03404 8.37158 1.09876L13.6216 4.09876C13.7363 4.16438 13.8316 4.25915 13.8979 4.37347C13.9642 4.48779 13.9992 4.6176 13.9992 4.74976C13.9992 4.88191 13.9642 5.01172 13.8979 5.12604C13.8316 5.24036 13.7363 5.33513 13.6216 5.40076L8.37158 8.40076C8.25828 8.46548 8.13006 8.49952 7.99958 8.49952C7.8691 8.49952 7.74088 8.46548 7.62758 8.40076L2.37758 5.40076C2.26287 5.33513 2.16753 5.24036 2.10123 5.12604C2.03492 5.01172 2 4.88191 2 4.74976C2 4.6176 2.03492 4.48779 2.10123 4.37347C2.16753 4.25915 2.26287 4.16438 2.37758 4.09876L7.62758 1.09876Z"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <path
          d="M2.56958 7.23928L2.37758 7.34928C2.26287 7.41491 2.16753 7.50968 2.10123 7.624C2.03492 7.73831 2 7.86813 2 8.00028C2 8.13244 2.03492 8.26225 2.10123 8.37657C2.16753 8.49089 2.26287 8.58566 2.37758 8.65128L7.62758 11.6513C7.74088 11.716 7.8691 11.75 7.99958 11.75C8.13006 11.75 8.25828 11.716 8.37158 11.6513L13.6216 8.65128C13.7365 8.58573 13.8321 8.49093 13.8986 8.3765C13.965 8.26208 14 8.13211 14 7.99978C14 7.86745 13.965 7.73748 13.8986 7.62306C13.8321 7.50864 13.7365 7.41384 13.6216 7.34828L13.4296 7.23828L9.11558 9.70328C8.77568 9.89744 8.39102 9.99956 7.99958 9.99956C7.60814 9.99956 7.22347 9.89744 6.88358 9.70328L2.56958 7.23928Z"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <path
          d="M2.37845 10.5993L2.57045 10.4893L6.88445 12.9533C7.22435 13.1474 7.60901 13.2496 8.00045 13.2496C8.39189 13.2496 8.77656 13.1474 9.11645 12.9533L13.4305 10.4883L13.6225 10.5983C13.7374 10.6638 13.833 10.7586 13.8994 10.8731C13.9659 10.9875 14.0009 11.1175 14.0009 11.2498C14.0009 11.3821 13.9659 11.5121 13.8994 11.6265C13.833 11.7409 13.7374 11.8357 13.6225 11.9013L8.37245 14.9013C8.25915 14.966 8.13093 15 8.00045 15C7.86997 15 7.74175 14.966 7.62845 14.9013L2.37845 11.9013C2.2635 11.8357 2.16795 11.7409 2.10148 11.6265C2.03501 11.5121 2 11.3821 2 11.2498C2 11.1175 2.03501 10.9875 2.10148 10.8731C2.16795 10.7586 2.2635 10.6638 2.37845 10.5983V10.5993Z"
          stroke="currentColor"
          strokeWidth="1.25"
        />
      </svg>
    ),
    badge: '100% OPEN SOURCE',
    githubUrl: 'https://github.com/kortix-ai/suna',
    title: 'Kortix – Build, manage and train your AI Workforce.',
    description:
      'Kortix – open-source platform to build, manage and train your AI Workforce.',
    inputPlaceholder: 'Ask Kortix to...',
  },
  cloudPricingItems: [
    {
      name: 'Basic',
      price: '$0',
      yearlyPrice: '$0',
      originalYearlyPrice: '$0',
      discountPercentage: 0,
      description: 'Perfect for getting started',
      buttonText: 'Select',
      buttonColor: 'bg-secondary text-white',
      isPopular: false,
      hours: '0 hours',
      features: [
        '200 credits/month',
        '1 custom Worker',
        '1 private project',
        '1 custom trigger',
      ],
      tierKey: config.SUBSCRIPTION_TIERS.FREE_TIER.tierKey,
      upgradePlans: [],
      stripePriceId: 'price_free',
      yearlyStripePriceId: 'price_free_yearly',
      monthlyCommitmentStripePriceId: 'price_free_commitment',
    },
    {
      name: 'Plus',
      price: '$20',
      yearlyPrice: '$204',
      originalYearlyPrice: '$240',
      discountPercentage: 15,
      description: 'Best for individuals and small teams',
      buttonText: 'Get started',
      buttonColor: 'bg-primary text-white dark:text-black',
      isPopular: true,
      hours: '2 hours',
      features: [
        '2,000 credits/month',
        '5 custom workers',
        'Private projects',
        '100+ integrations',
        'Premium AI Models',
      ],
      tierKey: config.SUBSCRIPTION_TIERS.TIER_2_20.tierKey,
      upgradePlans: [],
      stripePriceId: 'price_plus_monthly',
      yearlyStripePriceId: 'price_plus_yearly',
      monthlyCommitmentStripePriceId: 'price_plus_commitment',
    },
    {
      name: 'Pro',
      price: '$50',
      yearlyPrice: '$510',
      originalYearlyPrice: '$600',
      discountPercentage: 15,
      description: 'Ideal for growing businesses',
      buttonText: 'Get started',
      buttonColor: 'bg-secondary text-white',
      isPopular: false,
      hours: '6 hours',
      features: [
        '5,000 credits/month',
        '20 custom workers',
        'Private projects',
        '100+ integrations',
        'Premium AI Models',
      ],
      tierKey: config.SUBSCRIPTION_TIERS.TIER_6_50.tierKey,
      upgradePlans: [],
      stripePriceId: 'price_pro_monthly',
      yearlyStripePriceId: 'price_pro_yearly',
      monthlyCommitmentStripePriceId: 'price_pro_commitment',
    },
    {
      name: 'Business',
      price: '$100',
      yearlyPrice: '$1020',
      originalYearlyPrice: '$1200',
      discountPercentage: 15,
      description: 'For established businesses',
      buttonText: 'Get started',
      buttonColor: 'bg-secondary text-white',
      isPopular: false,
      hours: '12 hours',
      features: [
        '10,000 credits/month',
        '20 custom workers',
        'Private projects',
        '100+ integrations',
        'Premium AI Models',
      ],
      tierKey: config.SUBSCRIPTION_TIERS.TIER_12_100.tierKey,
      upgradePlans: [],
      hidden: true,
      stripePriceId: 'price_business_monthly',
      yearlyStripePriceId: 'price_business_yearly',
      monthlyCommitmentStripePriceId: 'price_business_commitment',
    },
    {
      name: 'Ultra',
      price: '$200',
      yearlyPrice: '$2040',
      originalYearlyPrice: '$2400',
      discountPercentage: 15,
      description: 'For power users',
      buttonText: 'Get started',
      buttonColor: 'bg-secondary text-white',
      isPopular: false,
      hours: '25 hours',
      features: [
        '20,000 credits/month',
        '100 custom workers',
        'Private projects',
        '100+ integrations',
        'Premium AI Models',
        'Priority Support',
      ],
      tierKey: config.SUBSCRIPTION_TIERS.TIER_25_200.tierKey,
      upgradePlans: [],
      stripePriceId: 'price_ultra_monthly',
      yearlyStripePriceId: 'price_ultra_yearly',
      monthlyCommitmentStripePriceId: 'price_ultra_commitment',
    },
    {
      name: 'Enterprise',
      price: '$400',
      yearlyPrice: '$4080',
      originalYearlyPrice: '$4800',
      discountPercentage: 15,
      description: 'For large teams',
      buttonText: 'Get started',
      buttonColor: 'bg-secondary text-white',
      isPopular: false,
      hours: '50 hours',
      features: [
        '40,000 credits/month',
        'Private projects',
        '100+ integrations',
        'Premium AI Models',
        'Priority support',
      ],
      tierKey: config.SUBSCRIPTION_TIERS.TIER_50_400.tierKey,
      upgradePlans: [],
      hidden: true,
      stripePriceId: 'price_enterprise_monthly',
      yearlyStripePriceId: 'price_enterprise_yearly',
      monthlyCommitmentStripePriceId: 'price_enterprise_commitment',
    },
    {
      name: 'Scale',
      price: '$800',
      yearlyPrice: '$8160',
      originalYearlyPrice: '$9600',
      discountPercentage: 15,
      description: 'For scaling teams',
      buttonText: 'Get started',
      buttonColor: 'bg-secondary text-white',
      isPopular: false,
      hours: '125 hours',
      features: [
        '80,000 credits/month',
        'Private projects',
        '100+ integrations',
        'Premium AI Models',
        'Priority support',
        'Dedicated account manager',
      ],
      tierKey: config.SUBSCRIPTION_TIERS.TIER_125_800.tierKey,
      upgradePlans: [],
      hidden: true,
      stripePriceId: 'price_scale_monthly',
      yearlyStripePriceId: 'price_scale_yearly',
      monthlyCommitmentStripePriceId: 'price_scale_commitment',
    },
    {
      name: 'Max',
      price: '$1000',
      yearlyPrice: '$10200',
      originalYearlyPrice: '$12000',
      discountPercentage: 15,
      description: 'Maximum performance',
      buttonText: 'Get started',
      buttonColor: 'bg-secondary text-white',
      isPopular: false,
      hours: '200 hours',
      features: [
        '100,000 credits/month',
        'Private projects',
        '100+ integrations',
        'Premium AI Models',
        'Priority support',
        'Dedicated account manager',
        'Custom deployment',
      ],
      tierKey: config.SUBSCRIPTION_TIERS.TIER_200_1000.tierKey,
      upgradePlans: [],
      hidden: true,
      stripePriceId: 'price_max_monthly',
      yearlyStripePriceId: 'price_max_yearly',
      monthlyCommitmentStripePriceId: 'price_max_commitment',
    },
  ],
  footerLinks: [
    {
      title: 'Kortix',
      links: [
        { id: 1, title: 'About', url: 'https://kortix.com' },
        { id: 3, title: 'Contact', url: 'mailto:hey@kortix.com' },
        { id: 4, title: 'Careers', url: 'https://kortix.com/careers' },
      ],
    },
    {
      title: 'Resources',
      links: [
        {
          id: 5,
          title: 'Documentation',
          url: 'https://github.com/Kortix-ai/Suna',
        },
        { id: 7, title: 'Discord', url: 'https://discord.gg/Py6pCBUUPw' },
        { id: 8, title: 'GitHub', url: 'https://github.com/Kortix-ai/Suna' },
      ],
    },
    {
      title: 'Legal',
      links: [
        {
          id: 9,
          title: 'Privacy Policy',
          url: 'https://kortix.com/legal?tab=privacy',
        },
        {
          id: 10,
          title: 'Terms of Service',
          url: 'https://kortix.com/legal?tab=terms',
        },
        {
          id: 11,
          title: 'License Apache 2.0',
          url: 'https://github.com/Kortix-ai/Suna/blob/main/LICENSE',
        },
      ],
    },
  ],
  companyShowcase: {
    companyLogos: [
      { id: 1, name: 'Company 1', logo: '/images/companies/company1.png' },
      { id: 2, name: 'Company 2', logo: '/images/companies/company2.png' },
      { id: 3, name: 'Company 3', logo: '/images/companies/company3.png' },
      { id: 4, name: 'Company 4', logo: '/images/companies/company4.png' },
    ],
  },
  ctaSection: {
    title: 'Ready to get started?',
    description: 'Join thousands of users building with Kortix',
    button: {
      text: 'Start Free',
      href: '/signup',
    },
    subtext: 'No credit card required',
  },
  faqSection: {
    title: 'Frequently Asked Questions',
    description: 'Find answers to common questions about Kortix',
    faQitems: [
      {
        id: 1,
        question: 'What is Kortix?',
        answer: 'Kortix is an open-source platform for building and managing AI workers.',
      },
      {
        id: 2,
        question: 'How do I get started?',
        answer: 'You can start for free with our basic tier. No credit card required.',
      },
    ],
  },
  featureSection: {
    title: 'Powerful Features',
    description: 'Everything you need to build amazing AI applications',
    items: [
      {
        id: 1,
        title: 'Easy to Use',
        content: 'Simple and intuitive interface for building AI workers',
      },
      {
        id: 2,
        title: 'Scalable',
        content: 'Built for growth with enterprise-grade infrastructure',
      },
      {
        id: 3,
        title: 'Open Source',
        content: 'Fully open source and customizable for your needs',
      },
    ],
  },
  quoteSection: {
    quote: 'Kortix makes it easy to build and deploy AI workers at scale.',
    author: {
      name: 'Happy Customer',
      image: '/images/avatar.png',
      role: 'CEO',
    },
  },
  testimonials: [
    {
      id: '1',
      name: 'John Doe',
      role: 'CEO at TechCorp',
      image: '/images/testimonial1.png',
      img: '/images/testimonial1.png',
      quote: 'Kortix transformed how we build AI solutions.',
      description: 'Kortix transformed how we build AI solutions.',
    },
    {
      id: '2',
      name: 'Jane Smith',
      role: 'CTO at StartupXYZ',
      image: '/images/testimonial2.png',
      img: '/images/testimonial2.png',
      quote: 'The best platform for AI worker management.',
      description: 'The best platform for AI worker management.',
    },
  ],
  useCases: [
    {
      id: '1',
      title: 'Data Processing',
      description: 'Automate data processing workflows',
      featured: true,
      category: 'Automation',
      icon: 'database',
      image: '/images/use-case-1.png',
      url: '/use-cases/data-processing',
    },
    {
      id: '2',
      title: 'Content Generation',
      description: 'Generate content at scale',
      featured: true,
      category: 'Content',
      icon: 'pen',
      image: '/images/use-case-2.png',
      url: '/use-cases/content-generation',
    },
  ],
};

export type SiteConfig = typeof siteConfig;
