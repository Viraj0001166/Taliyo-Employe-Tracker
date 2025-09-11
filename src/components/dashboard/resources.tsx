import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Resource } from "@/lib/types";
import { BookCopy } from "lucide-react";
import { CopyButton } from "../common/copy-button";

interface ResourcesProps {
  resources: Resource[];
}

export function Resources({ resources }: ResourcesProps) {
  const groupedResources = resources.reduce((acc, resource) => {
    (acc[resource.category] = acc[resource.category] || []).push(resource);
    return acc;
  }, {} as Record<string, Resource[]>);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Resources & Templates</CardTitle>
        <CardDescription>Ready-made scripts for you to use.</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {Object.entries(groupedResources).map(([category, items]) => (
            <AccordionItem value={category} key={category}>
              <AccordionTrigger className="text-base font-semibold">{category}</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 pt-2">
                  {items.map((item) => (
                    <li key={item.id} className="p-3 rounded-md border bg-secondary/50">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-medium text-secondary-foreground">{item.title}</h4>
                            <CopyButton textToCopy={item.content} />
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap font-mono p-2 bg-background rounded-md">
                            {item.content}
                        </p>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
