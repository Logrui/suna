'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/utils';
import { GrainText } from '@/components/ui/grain-text';
import { GrainIcon } from '@/components/ui/grain-icon';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DynamicIcon } from 'lucide-react/dynamic';
import { Computer } from 'lucide-react';
import { KortixLogo } from '@/components/sidebar/kortix-logo';

interface WorkerType {
    id: string;
    iconName: string;
    iconColor: string;
    backgroundColor: string;
    borderColor: string;
    title: string;
    description: string;
    capabilities: string[];
    image: string;
    imageAlt: string;
    fileType: string;
}

const workerConfigs = [
    {
        id: 'slides',
        iconName: 'presentation',
        iconColor: '#000000',
        backgroundColor: '#FFCD7E',
        borderColor: '#E0B46F',
        image: '/images/landing-showcase/slides.png',
        fileTypeKey: 'pptx',
        title: 'Presentation Specialist',
        description: 'Creates professional slide decks from your content, complete with speaker notes and design layouts.',
        capabilities: [
            'Slide Generation',
            'Theme Customization',
            'Speaker Notes',
            'Data Visualization',
            'Layout Design',
            'Export to PPTX'
        ],
        imageAlt: 'Presentation slide preview',
        fileType: 'PPTX'
    },
    {
        id: 'data',
        iconName: 'bar-chart-3',
        iconColor: '#000000',
        backgroundColor: '#9DC2FF',
        borderColor: '#91B6F3',
        image: '/images/landing-showcase/data.png',
        fileTypeKey: 'preview',
        title: 'Data Analyst',
        description: 'Analyzes complex datasets, generates insights, and creates interactive visualizations.',
        capabilities: [
            'Data Analysis',
            'Chart Creation',
            'Trend Identification',
            'Statistical Summary',
            'Report Generation',
            'Data Cleaning'
        ],
        imageAlt: 'Data analysis dashboard',
        fileType: 'CSV/JSON'
    },
    {
        id: 'docs',
        iconName: 'file-text',
        iconColor: '#000000',
        backgroundColor: '#82DD95',
        borderColor: '#72C283',
        image: '/images/landing-showcase/docs.png',
        fileTypeKey: 'document',
        title: 'Document Writer',
        description: 'Drafts comprehensive documents, reports, and articles with proper formatting and structure.',
        capabilities: [
            'Content Drafting',
            'Formatting',
            'Editing',
            'Research Integration',
            'Citation Management',
            'Export to PDF/DOCX'
        ],
        imageAlt: 'Document editor interface',
        fileType: 'DOCX'
    },
    {
        id: 'research',
        iconName: 'search',
        iconColor: '#000000',
        backgroundColor: '#FFB5E4',
        borderColor: '#EF9FD1',
        image: '/images/landing-showcase/research.png',
        fileTypeKey: 'document',
        title: 'Research Assistant',
        description: 'Conducts deep research on any topic, synthesizing information from multiple sources.',
        capabilities: [
            'Web Search',
            'Source Verification',
            'Summary Generation',
            'Fact Checking',
            'Topic Exploration',
            'Bibliography'
        ],
        imageAlt: 'Research results view',
        fileType: 'PDF'
    },
    {
        id: 'images',
        iconName: 'image',
        iconColor: '#000000',
        backgroundColor: '#FFAFAF',
        borderColor: '#F19C9C',
        image: '/images/landing-showcase/images.png',
        fileTypeKey: 'image',
        title: 'Image Creator',
        description: 'Generates high-quality images and artwork based on your detailed descriptions.',
        capabilities: [
            'Image Generation',
            'Style Transfer',
            'Image Editing',
            'Variation Creation',
            'Upscaling',
            'Format Conversion'
        ],
        imageAlt: 'Image generation gallery',
        fileType: 'PNG/JPG'
    }
];

export function ShowCaseSection() {
    const [activeWorker, setActiveWorker] = useState<string>(workerConfigs[0].id);
    const isMobile = useIsMobile();

    const workers: WorkerType[] = workerConfigs.map((config) => ({
        ...config,
        // Properties are now directly in the config object
    }));

    const currentWorker = workers.find(w => w.id === activeWorker) || workers[0];

    return (
        <section className="w-full px-6 py-16 md:py-24 lg:py-32">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12 md:mb-16">
                    <h1 className="text-[43px] font-medium leading-tight mb-4">
                        Meet Your New AI Workforce
                    </h1>
                    <h2 className="text-base md:text-lg max-w-3xl mx-auto block text-muted-foreground font-normal">
                        Specialized agents ready to handle your most complex tasks.
                    </h2>
                </div>

                {/* Workers Grid */}
                <div className="space-y-6">
                    {workers.map((worker) => (
                        <Card
                            key={worker.id}
                            className="transition-all duration-300 cursor-pointer !rounded-[24px] !p-6"
                            onMouseEnter={() => !isMobile && setActiveWorker(worker.id)}
                            onClick={() => isMobile && setActiveWorker(worker.id)}
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                                {/* Left side - Info */}
                                <div className="flex flex-col">
                                    <div className="space-y-4 flex-1">
                                        {/* Icon */}
                                        <GrainIcon
                                            iconName={worker.iconName}
                                            backgroundColor={worker.backgroundColor}
                                            borderColor={worker.borderColor}
                                        />

                                        {/* Title */}
                                        <h3 className="text-[32px] font-semibold leading-tight">
                                            {worker.title}
                                        </h3>

                                        {/* Description */}
                                        <GrainText className="text-sm md:text-base leading-relaxed text-muted-foreground">
                                            {worker.description}
                                        </GrainText>

                                        {/* Capabilities */}
                                        <div className="flex flex-wrap gap-2">
                                            {worker.capabilities.map((capability, idx) => (
                                                <Badge
                                                    key={idx}
                                                    variant="outline"
                                                    className="text-sm h-9 px-4"
                                                >
                                                    {capability}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>

                                    {/* CTA Button - Always at bottom */}
                                    <Link href="/auth">
                                        <Button
                                            variant="default"
                                            size="default"
                                            className="w-fit flex items-center justify-center gap-2 bg-primary text-primary-foreground mt-4"
                                        >
                                            Try It Out
                                            <span>→</span>
                                        </Button>
                                    </Link>
                                </div>

                                {/* Right side - Computer Preview */}
                                <div className="relative">
                                    <Card className="overflow-hidden transition-all duration-300 !p-0 h-full !rounded-[24px] flex flex-col !border-0 !gap-0">
                                        {/* Computer header */}
                                        <div className="bg-black text-white px-4 flex items-center justify-between flex-shrink-0 h-[65px]">
                                            <div className="flex items-center gap-2">
                                                <KortixLogo size={16} className="invert" />
                                                <span className="text-xl font-medium">
                                                    Kortix Computer
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                <span className="text-xs text-green-500 font-medium">Running</span>
                                            </div>
                                        </div>

                                        {/* Preview Image */}
                                        <div className="relative flex-1 bg-black overflow-hidden min-h-0 aspect-[539/271]">
                                            <Image
                                                src={worker.image}
                                                alt={worker.imageAlt}
                                                fill
                                                className="object-cover"
                                                priority={worker.id === workers[0].id}
                                            />
                                        </div>

                                        {/* Footer with file type */}
                                        <div className="bg-black text-white px-4 flex items-center flex-shrink-0 h-[71px]">
                                            <Badge variant="outline" className="text-xs font-mono gap-1.5 border-white/20 text-white">
                                                <svg
                                                    className="w-3 h-3"
                                                    viewBox="0 0 16 16"
                                                    fill="currentColor"
                                                >
                                                    <path d="M9 1H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6L9 1zM8.5 2v4H13v7H3V2h5.5z" />
                                                </svg>
                                                {worker.fileType}
                                            </Badge>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
